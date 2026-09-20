import uuid

from fastapi import status

from app.core.audit.stats import compute_audit_routing_stats
from app.core.eval.telemetry import EvalTelemetry
from app.models.connection import QueryAuditLog


def test_compute_audit_routing_stats_buckets():
    logs = [
        QueryAuditLog(
            user_id=1,
            question="q1",
            sql_query="SELECT 1",
            status="success",
            resolution_source="heuristic",
            execution_duration_ms=100,
            eval_telemetry_json=EvalTelemetry(used_llm=False).to_json(),
        ),
        QueryAuditLog(
            user_id=1,
            question="q2",
            sql_query="SELECT 2",
            status="success",
            resolution_source="llm",
            execution_duration_ms=300,
            eval_telemetry_json=EvalTelemetry(
                used_llm=True,
                escalation_reason="validation_failed",
            ).to_json(),
        ),
    ]
    stats = compute_audit_routing_stats(logs)
    assert stats.total_queries == 2
    assert stats.heuristic_count == 1
    assert stats.llm_count == 1
    assert stats.heuristic_percent == 50.0
    assert stats.llm_percent == 50.0
    assert stats.avg_duration_ms == 200
    assert stats.escalation_reasons.get("validation_failed") == 1


def test_audit_stats_api(client, db):
    email = f"audit_stats_{uuid.uuid4().hex}@example.com"
    password = "Password123!"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Audit Stats"},
    )
    headers = {
        "Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': password}).json()['access_token']}"
    }

    response = client.get("/api/v1/audit/stats", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert "heuristic_percent" in payload
    assert "llm_percent" in payload
    assert "escalation_reasons" in payload
    assert payload["sample_size"] >= 0
