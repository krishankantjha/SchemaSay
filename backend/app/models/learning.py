from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.database import Base


class QueryFeedback(Base):
    """
    User feedback on generated queries used to improve future SQL generation.
    """
    __tablename__ = "query_feedback"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connection_id = Column(
        Integer,
        ForeignKey("database_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    audit_log_id = Column(Integer, ForeignKey("query_audit_logs.id", ondelete="SET NULL"), nullable=True, index=True)

    question = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    corrected_sql = Column(Text, nullable=True)
    rating = Column(String, nullable=False)  # thumbs_up, thumbs_down, corrected
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
