const KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "HAVING",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "ON",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "LIKE",
  "ILIKE",
  "BETWEEN",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "UNION",
  "ALL",
  "WITH",
  "ASC",
  "DESC",
  "TRUE",
  "FALSE",
  "EXISTS",
  "OVER",
  "PARTITION",
  "ROWS",
  "RANGE",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "CURRENT",
  "ROW",
  "CAST",
  "USING",
  "NATURAL",
]);

const FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "NULLIF",
  "ROUND",
  "ABS",
  "LOWER",
  "UPPER",
  "TRIM",
  "LENGTH",
  "SUBSTR",
  "SUBSTRING",
  "REPLACE",
  "CONCAT",
  "DATE_TRUNC",
  "DATE_PART",
  "EXTRACT",
  "NOW",
  "CURRENT_DATE",
  "CURRENT_TIMESTAMP",
  "CAST",
  "TO_CHAR",
  "TO_DATE",
  "LAG",
  "LEAD",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(cls: string, value: string): string {
  return `<span class="${cls}">${escapeHtml(value)}</span>`;
}

/** Tokenize SQL into highlighted HTML. Values are escaped for innerHTML. */
export function highlightSql(sql: string): string {
  let i = 0;
  let out = "";
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    if (ch === "-" && sql[i + 1] === "-") {
      let j = i + 2;
      while (j < n && sql[j] !== "\n") j += 1;
      out += wrap("cmt", sql.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "/" && sql[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(sql[j] === "*" && sql[j + 1] === "/")) j += 1;
      j = Math.min(n, j + 2);
      out += wrap("cmt", sql.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === quote) {
          if (sql[j + 1] === quote) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      out += wrap(quote === "'" ? "str" : "ident", sql.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "`") {
      let j = i + 1;
      while (j < n && sql[j] !== "`") j += 1;
      j = Math.min(n, j + 1);
      out += wrap("ident", sql.slice(i, j));
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9.]/.test(sql[j])) j += 1;
      out += wrap("num", sql.slice(i, j));
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j += 1;
      const token = sql.slice(i, j);
      const upper = token.toUpperCase();
      if (KEYWORDS.has(upper)) out += wrap("kw", token);
      else if (FUNCTIONS.has(upper)) out += wrap("fn", token);
      else out += wrap("ident", token);
      i = j;
      continue;
    }

    out += escapeHtml(ch);
    i += 1;
  }

  return out;
}
