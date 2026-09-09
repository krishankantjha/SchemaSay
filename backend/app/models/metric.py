import json
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class MetricDefinition(Base):
    """
    Governed business metric bound to a database connection.
    Maps plain-language concepts to validated SQL expressions.
    """
    __tablename__ = "metric_definitions"
    __table_args__ = (
        UniqueConstraint("connection_id", "name", name="uq_metric_connection_name"),
    )

    id = Column(Integer, primary_key=True)
    connection_id = Column(
        Integer,
        ForeignKey("database_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sql_expression = Column(Text, nullable=False)
    base_table = Column(String, nullable=False)
    default_filters = Column(Text, nullable=True)
    dimensions_json = Column(Text, nullable=False, default="[]")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    connection = relationship("DatabaseConnection", back_populates="metrics")

    def get_dimensions(self) -> list[dict]:
        try:
            return json.loads(self.dimensions_json or "[]")
        except json.JSONDecodeError:
            return []

    def set_dimensions(self, dimensions: list[dict]) -> None:
        self.dimensions_json = json.dumps(dimensions)
