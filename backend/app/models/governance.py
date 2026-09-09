import json

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class ConnectionPolicy(Base):
    """
    Per-connection data access policy for governed query execution.
    """
    __tablename__ = "connection_policies"
    __table_args__ = (
        UniqueConstraint("connection_id", name="uq_connection_policy"),
    )

    id = Column(Integer, primary_key=True)
    connection_id = Column(
        Integer,
        ForeignKey("database_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    blocked_tables_json = Column(Text, nullable=False, default="[]")
    blocked_columns_json = Column(Text, nullable=False, default="[]")
    require_high_confidence = Column(Boolean, nullable=False, default=False)
    min_confidence_threshold = Column(Integer, nullable=False, default=50)
    block_pii_access = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    connection = relationship("DatabaseConnection", back_populates="policy")

    def get_blocked_tables(self) -> list[str]:
        return self._parse_list(self.blocked_tables_json)

    def get_blocked_columns(self) -> list[str]:
        return self._parse_list(self.blocked_columns_json)

    def set_blocked_tables(self, values: list[str]) -> None:
        self.blocked_tables_json = json.dumps(values)

    def set_blocked_columns(self, values: list[str]) -> None:
        self.blocked_columns_json = json.dumps(values)

    @staticmethod
    def _parse_list(raw: str | None) -> list[str]:
        if not raw:
            return []
        try:
            return [str(item) for item in json.loads(raw)]
        except json.JSONDecodeError:
            return []
