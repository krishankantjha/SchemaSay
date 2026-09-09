from fastapi import status

def test_register_user_success(client):
    """
    Verifies that a user can successfully register with valid details.
    """
    payload = {
        "email": "register_test@example.com",
        "password": "Password123!",
        "full_name": "Test User"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "register_test@example.com"
    assert data["full_name"] == "Test User"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["is_active"] is True

def test_register_password_complexity_failure(client):
    """
    Verifies that password requirements (length, uppercase, digit, symbol) are strictly enforced.
    """
    # Too short
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "Short1!"
    })
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # No uppercase
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "lowercase1!"
    })
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # No digit
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "NoDigits!"
    })
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # No special character
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "NoSpecial1"
    })
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

def test_register_duplicate_email_conflict(client):
    """
    Verifies that duplicate registration attempts return 409 Conflict.
    """
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "full_name": "Original User"
    }
    # First attempt
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == status.HTTP_201_CREATED

    # Second attempt
    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == status.HTTP_409_CONFLICT
    assert res2.json()["detail"] == "A user with this email address already exists"

def test_login_success(client):
    """
    Verifies that successful login returns access and refresh tokens.
    """
    # Register
    client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "Password123!"
    })
    
    # Login
    response = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "Password123!"
    })
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_credentials(client):
    """
    Verifies that incorrect credentials return 401 Unauthorized.
    """
    # Register
    client.post("/api/v1/auth/register", json={
        "email": "invalid@example.com",
        "password": "Password123!"
    })
    
    # Login with wrong password
    response = client.post("/api/v1/auth/login", json={
        "email": "invalid@example.com",
        "password": "WrongPassword123!"
    })
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid email or password"

def test_login_brute_force_lockout(client):
    """
    Verifies that 5 failed login attempts locks the user account for 15 minutes.
    """
    email = "lockout@example.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!"
    })
    
    # Fail 5 times
    for _ in range(5):
        res = client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword123!"
        })
        assert res.status_code == status.HTTP_401_UNAUTHORIZED
        
    # 6th attempt should be blocked with 403 Forbidden
    blocked_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"  # Correct password
    })
    assert blocked_res.status_code == status.HTTP_403_FORBIDDEN
    assert "locked due to too many failed attempts" in blocked_res.json()["detail"]

def test_get_current_user_me(client):
    """
    Verifies that a valid token can query the protected /me endpoint.
    """
    email = "me@example.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Me User"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == status.HTTP_200_OK
    assert me_res.json()["email"] == email

def test_refresh_token_rotation(client, db):
    """
    Verifies token rotation via the /refresh endpoint. Consumes old refresh token,
    returns new pairs, and invalidates the old token database entry.
    """
    email = "refresh@example.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    tokens = login_res.json()
    old_refresh = tokens["refresh_token"]
    
    # Consume refresh token
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == status.HTTP_200_OK
    new_tokens = refresh_res.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["refresh_token"] != old_refresh
    
    # Try using old refresh token again (should fail as revoked)
    reuse_res = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Session compromise detected" in reuse_res.json()["detail"]

def test_logout_revokes_token(client):
    """
    Verifies that logging out invalidates access tokens and revokes refresh tokens.
    """
    email = "logout@example.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!"
    })
    
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    tokens = login_res.json()
    access = tokens["access_token"]
    
    # Confirm access works
    headers = {"Authorization": f"Bearer {access}"}
    me_before = client.get("/api/v1/auth/me", headers=headers)
    assert me_before.status_code == status.HTTP_200_OK
    
    # Logout
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == status.HTTP_200_OK
    
    # Confirm access is now blocked (blacklisted)
    me_after = client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == status.HTTP_401_UNAUTHORIZED
