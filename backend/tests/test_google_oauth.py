"""Tests for Google OAuth authentication flow."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status

from app.config import settings


@pytest.fixture
def google_settings(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(
        settings,
        "GOOGLE_REDIRECT_URI",
        "http://testserver/api/v1/auth/google/callback",
    )
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:5173")


def test_google_login_redirect_when_configured(client, google_settings):
    response = client.get("/api/v1/auth/google", follow_redirects=False)
    assert response.status_code == status.HTTP_307_TEMPORARY_REDIRECT
    assert response.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "client_id=test-client-id" in response.headers["location"]
    assert "state=" in response.headers["location"]


def test_google_login_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", None)

    response = client.get("/api/v1/auth/google")
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


@patch("app.api.routes.auth.exchange_code_for_userinfo", new_callable=AsyncMock)
def test_google_callback_creates_user(mock_exchange, client, google_settings):
    login_response = client.get("/api/v1/auth/google", follow_redirects=False)
    state = login_response.headers["location"].split("state=")[1].split("&")[0]

    mock_exchange.return_value = {
        "sub": "google-user-123",
        "email": "google@example.com",
        "email_verified": True,
        "name": "Google User",
    }

    response = client.get(
        f"/api/v1/auth/google/callback?code=test-code&state={state}",
        follow_redirects=False,
    )

    assert response.status_code == status.HTTP_307_TEMPORARY_REDIRECT
    location = response.headers["location"]
    assert location.startswith("http://localhost:5173/auth/callback#")
    assert "access_token=" in location
    assert "refresh_token=" in location


@patch("app.api.routes.auth.exchange_code_for_userinfo", new_callable=AsyncMock)
def test_google_callback_links_existing_email_user(mock_exchange, client, google_settings):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "existing@example.com",
            "password": "Password123!",
            "full_name": "Existing User",
        },
    )

    login_response = client.get("/api/v1/auth/google", follow_redirects=False)
    state = login_response.headers["location"].split("state=")[1].split("&")[0]

    mock_exchange.return_value = {
        "sub": "google-user-456",
        "email": "existing@example.com",
        "email_verified": True,
        "name": "Existing User",
    }

    response = client.get(
        f"/api/v1/auth/google/callback?code=test-code&state={state}",
        follow_redirects=False,
    )

    assert response.status_code == status.HTTP_307_TEMPORARY_REDIRECT
    assert "access_token=" in response.headers["location"]


def test_password_login_blocked_for_google_only_user(client, google_settings):
    login_response = client.get("/api/v1/auth/google", follow_redirects=False)
    state = login_response.headers["location"].split("state=")[1].split("&")[0]

    with patch("app.api.routes.auth.exchange_code_for_userinfo", new_callable=AsyncMock) as mock_exchange:
        mock_exchange.return_value = {
            "sub": "google-only-999",
            "email": "oauthonly@example.com",
            "email_verified": True,
            "name": "OAuth Only",
        }
        client.get(
            f"/api/v1/auth/google/callback?code=test-code&state={state}",
            follow_redirects=False,
        )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "oauthonly@example.com", "password": "Password123!"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Google sign-in" in response.json()["detail"]
