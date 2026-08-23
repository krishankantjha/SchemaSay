from typing import List, Dict
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.config import settings

def reflect_database_schema(engine: Engine) -> List[Dict[str, str]]:
    """
    Introspects the target database connection, maps all tables, columns, 
    data types, and primary/foreign key relationships.
    
    Args:
        engine: The active SQLAlchemy connection engine.
        
    Returns:
        A list of dictionaries containing:
        - table_name: Name of the database table.
        - column_name: Name of the column.
        - data_type: Column data type string, enriched with PK/FK metadata.
    """
    inspector = inspect(engine)
    schema_cache = []
    
    # Retrieve default schemas tables (excluding system tables)
    table_names = inspector.get_table_names()
    
    for table_name in table_names:
        # Retrieve primary keys
        pk_constraint = inspector.get_pk_constraint(table_name)
        pk_columns = pk_constraint.get("constrained_columns", []) if pk_constraint else []
        
        # Retrieve foreign keys and build referred map
        fk_list = inspector.get_foreign_keys(table_name)
        fk_map = {}
        for fk in fk_list:
            ref_table = fk["referred_table"]
            for col, ref_col in zip(fk["constrained_columns"], fk["referred_columns"]):
                fk_map[col] = f"{ref_table}.{ref_col}"
                
        # Inspect columns list
        columns = inspector.get_columns(table_name)
        for col in columns:
            col_name = col["name"]
            raw_type = str(col["type"])
            
            # Enrich type description with key constraints metadata for the AI engine
            type_modifiers = []
            if col_name in pk_columns:
                type_modifiers.append("PRIMARY KEY")
            if col_name in fk_map:
                type_modifiers.append(f"FOREIGN KEY -> {fk_map[col_name]}")
                
            data_type_string = raw_type
            if type_modifiers:
                data_type_string += f" | {' | '.join(type_modifiers)}"
                
            if len(schema_cache) >= settings.MAX_SCHEMA_ENTRIES:
                raise ValueError("Database schema exceeds the supported metadata limit")
            schema_cache.append({
                "table_name": table_name,
                "column_name": col_name,
                "data_type": data_type_string
            })
            
    return schema_cache
