from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.core.pipeline import QueryPipeline, PipelineError
from app.core.schema.loader import load_schema_graph
from app.core.semantics.resolver import build_metric_sql, resolve_metric_question
from app.database import get_db
from app.models.connection import DatabaseConnection
from app.models.metric import MetricDefinition
from app.models.user import User
from app.schemas.metric import (
    MetricCreate,
    MetricPreviewRequest,
    MetricPreviewResponse,
    MetricResponse,
    MetricUpdate,
    MetricDimensionSchema,
)
from app.config import settings

router = APIRouter(prefix="/metrics", tags=["Semantic Metrics"])


def _get_owned_connection(connection_id: int, user_id: int, db: Session) -> DatabaseConnection:
    connection = db.query(DatabaseConnection).filter(
        DatabaseConnection.id == connection_id,
        DatabaseConnection.user_id == user_id,
    ).first()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database connection not found")
    return connection


def _get_owned_metric(metric_id: int, user_id: int, db: Session) -> MetricDefinition:
    metric = db.query(MetricDefinition).filter(
        MetricDefinition.id == metric_id,
        MetricDefinition.user_id == user_id,
    ).first()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")
    return metric


def _metric_response(metric: MetricDefinition) -> MetricResponse:
    return MetricResponse(
        id=metric.id,
        connection_id=metric.connection_id,
        name=metric.name,
        label=metric.label,
        description=metric.description,
        sql_expression=metric.sql_expression,
        base_table=metric.base_table,
        default_filters=metric.default_filters,
        dimensions=[MetricDimensionSchema(**dim) for dim in metric.get_dimensions()],
        created_at=metric.created_at,
        updated_at=metric.updated_at,
    )


@router.post("/", response_model=MetricResponse, status_code=status.HTTP_201_CREATED)
def create_metric(
    payload: MetricCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_connection(payload.connection_id, current_user.id, db)

    existing = db.query(MetricDefinition).filter(
        MetricDefinition.connection_id == payload.connection_id,
        MetricDefinition.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Metric '{payload.name}' already exists for this connection.",
        )

    metric = MetricDefinition(
        connection_id=payload.connection_id,
        user_id=current_user.id,
        name=payload.name,
        label=payload.label,
        description=payload.description,
        sql_expression=payload.sql_expression,
        base_table=payload.base_table,
        default_filters=payload.default_filters,
    )
    metric.set_dimensions([dim.model_dump() for dim in payload.dimensions])
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return _metric_response(metric)


@router.get("/", response_model=List[MetricResponse])
def list_metrics(
    connection_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_connection(connection_id, current_user.id, db)
    metrics = (
        db.query(MetricDefinition)
        .filter(
            MetricDefinition.connection_id == connection_id,
            MetricDefinition.user_id == current_user.id,
        )
        .order_by(MetricDefinition.label.asc())
        .all()
    )
    return [_metric_response(metric) for metric in metrics]


@router.get("/{metric_id}", response_model=MetricResponse)
def get_metric(
    metric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = _get_owned_metric(metric_id, current_user.id, db)
    return _metric_response(metric)


@router.put("/{metric_id}", response_model=MetricResponse)
def update_metric(
    metric_id: int,
    payload: MetricUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = _get_owned_metric(metric_id, current_user.id, db)

    if payload.label is not None:
        metric.label = payload.label
    if payload.description is not None:
        metric.description = payload.description
    if payload.sql_expression is not None:
        metric.sql_expression = payload.sql_expression
    if payload.base_table is not None:
        metric.base_table = payload.base_table
    if payload.default_filters is not None:
        metric.default_filters = payload.default_filters
    if payload.dimensions is not None:
        metric.set_dimensions([dim.model_dump() for dim in payload.dimensions])

    db.commit()
    db.refresh(metric)
    return _metric_response(metric)


@router.delete("/{metric_id}", status_code=status.HTTP_200_OK)
def delete_metric(
    metric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = _get_owned_metric(metric_id, current_user.id, db)
    db.delete(metric)
    db.commit()
    return {"message": "Metric deleted successfully"}


@router.post("/{metric_id}/preview", response_model=MetricPreviewResponse)
def preview_metric(
    metric_id: int,
    payload: MetricPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = _get_owned_metric(metric_id, current_user.id, db)
    connection = _get_owned_connection(metric.connection_id, current_user.id, db)
    graph = load_schema_graph(db, metric.connection_id)

    question = payload.question or f"Show {metric.label}"

    if payload.dimension_names:
        dimensions = [
            dim
            for dim in metric.get_dimensions()
            if dim.get("name") in payload.dimension_names
        ]
        sql, assumptions = build_metric_sql(metric, dimensions, connection.db_type, question)
        dimensions_used = [dim["name"] for dim in dimensions]
        match_score = 0.0
    else:
        resolved = resolve_metric_question(
            question=question,
            metrics=[metric],
            graph=graph,
            db_type=connection.db_type,
            match_threshold=0,
        )
        if resolved:
            sql = resolved.sql
            assumptions = resolved.assumptions
            dimensions_used = resolved.dimensions_used
            match_score = resolved.match_score
        else:
            dimensions = metric.get_dimensions()[:1]
            sql, assumptions = build_metric_sql(metric, dimensions, connection.db_type, question)
            dimensions_used = [dim["name"] for dim in dimensions]
            match_score = 0.0

    response = MetricPreviewResponse(
        metric_id=metric.id,
        metric_name=metric.name,
        sql=sql,
        match_score=match_score,
        dimensions_used=dimensions_used,
        assumptions=assumptions,
    )

    if payload.execute:
        pipeline = QueryPipeline(db)
        try:
            result = pipeline.run_raw_sql(
                user_id=current_user.id,
                connection=connection,
                sql=sql,
                question=question,
            )
        except PipelineError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message)

        response.results = result.results
        response.execution_duration_ms = result.execution_duration_ms

    return response
