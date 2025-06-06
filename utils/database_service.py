import sqlite3
import logging
import threading
import os
from datetime import datetime, date
from typing import Optional, Dict, List, Any
import json

logger = logging.getLogger(__name__)

class DatabaseService:
    """
    Database service for storing processing sessions, step outputs, and insights for reporting.
    Uses SQLite for simplicity and zero external dependencies.
    """
    
    def __init__(self, db_path: str = "data/reporting.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._ensure_db_directory()
        self._init_database()
        logger.info(f"DatabaseService initialized with SQLite at {db_path}")
    
    def _ensure_db_directory(self):
        """Ensure the database directory exists"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
    
    def _init_database(self):
        """Initialize database schema if not exists"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Core processing sessions
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS processing_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        request_id TEXT UNIQUE NOT NULL,
                        original_idea TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP,
                        status TEXT DEFAULT 'processing',
                        total_duration_seconds REAL,
                        error_message TEXT
                    )
                ''')
                
                # Individual step outputs and metrics
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS step_outputs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER REFERENCES processing_sessions(id),
                        step_id INTEGER NOT NULL,
                        step_name TEXT NOT NULL,
                        input_text TEXT,
                        output_text TEXT,
                        raw_llm_output TEXT,
                        duration_seconds REAL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        model_used TEXT,
                        token_count INTEGER,
                        cost_estimate REAL
                    )
                ''')
                
                # Extracted insights for analysis
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS insights (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER REFERENCES processing_sessions(id),
                        step_id INTEGER NOT NULL,
                        insight_text TEXT NOT NULL,
                        insight_label TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Usage analytics aggregated by date
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS usage_metrics (
                        date DATE PRIMARY KEY,
                        total_sessions INTEGER DEFAULT 0,
                        completed_sessions INTEGER DEFAULT 0,
                        failed_sessions INTEGER DEFAULT 0,
                        avg_duration_seconds REAL,
                        total_api_calls INTEGER DEFAULT 0,
                        total_tokens INTEGER DEFAULT 0,
                        estimated_cost REAL DEFAULT 0.0
                    )
                ''')
                
                # Create indexes for better query performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_request_id ON processing_sessions(request_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON processing_sessions(created_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_status ON processing_sessions(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_step_outputs_session_id ON step_outputs(session_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_step_outputs_step_id ON step_outputs(step_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_insights_session_id ON insights(session_id)')
                
                conn.commit()
                logger.info("Database schema initialized successfully")
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            # Don't raise - allow app to continue without database
    
    def save_processing_session(self, request_id: str, original_idea: str) -> Optional[int]:
        """Create new processing session record"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO processing_sessions (request_id, original_idea, created_at, status)
                    VALUES (?, ?, ?, 'processing')
                ''', (request_id, original_idea, datetime.now()))
                
                session_id = cursor.lastrowid
                conn.commit()
                logger.debug(f"Saved processing session {request_id} with session_id {session_id}")
                return session_id
                
        except Exception as e:
            logger.error(f"Failed to save processing session {request_id}: {e}")
            return None
    
    def update_session_completion(self, request_id: str, status: str, duration: Optional[float] = None, error: Optional[str] = None):
        """Mark session as completed/failed"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE processing_sessions 
                    SET completed_at = ?, status = ?, total_duration_seconds = ?, error_message = ?
                    WHERE request_id = ?
                ''', (datetime.now(), status, duration, error, request_id))
                
                conn.commit()
                logger.debug(f"Updated session {request_id} status to {status}")
                
        except Exception as e:
            logger.error(f"Failed to update session completion {request_id}: {e}")
    
    def save_step_output(self, request_id: str, step_id: int, step_name: str, 
                        input_text: Optional[str] = None, output_text: Optional[str] = None,
                        raw_llm_output: Optional[str] = None, duration_seconds: Optional[float] = None,
                        model_used: Optional[str] = None, token_count: Optional[int] = None,
                        cost_estimate: Optional[float] = None):
        """Store individual step results"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get session_id from request_id
                cursor.execute('SELECT id FROM processing_sessions WHERE request_id = ?', (request_id,))
                result = cursor.fetchone()
                if not result:
                    logger.warning(f"No session found for request_id {request_id}")
                    return
                
                session_id = result[0]
                
                cursor.execute('''
                    INSERT INTO step_outputs 
                    (session_id, step_id, step_name, input_text, output_text, raw_llm_output, 
                     duration_seconds, model_used, token_count, cost_estimate, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (session_id, step_id, step_name, input_text, output_text, raw_llm_output,
                      duration_seconds, model_used, token_count, cost_estimate, datetime.now()))
                
                conn.commit()
                logger.debug(f"Saved step {step_id} output for session {request_id}")
                
        except Exception as e:
            logger.error(f"Failed to save step output {request_id}/step_{step_id}: {e}")
    
    def save_insight(self, request_id: str, step_id: int, insight_text: str, insight_label: Optional[str] = None):
        """Store extracted insights"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get session_id from request_id
                cursor.execute('SELECT id FROM processing_sessions WHERE request_id = ?', (request_id,))
                result = cursor.fetchone()
                if not result:
                    logger.warning(f"No session found for request_id {request_id}")
                    return
                
                session_id = result[0]
                
                cursor.execute('''
                    INSERT INTO insights (session_id, step_id, insight_text, insight_label, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (session_id, step_id, insight_text, insight_label, datetime.now()))
                
                conn.commit()
                logger.debug(f"Saved insight for session {request_id}, step {step_id}")
                
        except Exception as e:
            logger.error(f"Failed to save insight {request_id}/step_{step_id}: {e}")
    
    def get_usage_analytics(self, start_date: Optional[str] = None, end_date: Optional[str] = None, 
                           granularity: str = 'daily') -> Dict[str, Any]:
        """Generate usage analytics report"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Build date filter
                date_filter = ""
                params = []
                if start_date:
                    date_filter += " AND DATE(created_at) >= ?"
                    params.append(start_date)
                if end_date:
                    date_filter += " AND DATE(created_at) <= ?"
                    params.append(end_date)
                
                # Get session statistics
                cursor.execute(f'''
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sessions,
                        AVG(total_duration_seconds) as avg_duration,
                        MIN(created_at) as earliest_session,
                        MAX(created_at) as latest_session
                    FROM processing_sessions 
                    WHERE 1=1 {date_filter}
                ''', params)
                
                stats = cursor.fetchone()
                
                # Get step-level analytics
                cursor.execute(f'''
                    SELECT 
                        so.step_id,
                        so.step_name,
                        COUNT(*) as executions,
                        AVG(so.duration_seconds) as avg_duration,
                        SUM(COALESCE(so.token_count, 0)) as total_tokens,
                        SUM(COALESCE(so.cost_estimate, 0)) as total_cost
                    FROM step_outputs so
                    JOIN processing_sessions ps ON so.session_id = ps.id
                    WHERE 1=1 {date_filter.replace('created_at', 'ps.created_at')}
                    GROUP BY so.step_id, so.step_name
                    ORDER BY so.step_id
                ''', params)
                
                step_analytics = cursor.fetchall()
                
                # Get daily trends if requested
                daily_trends = []
                if granularity == 'daily':
                    cursor.execute(f'''
                        SELECT 
                            DATE(ps.created_at) as date,
                            COUNT(*) as sessions,
                            SUM(CASE WHEN ps.status = 'completed' THEN 1 ELSE 0 END) as completed,
                            AVG(ps.total_duration_seconds) as avg_duration
                        FROM processing_sessions ps
                        WHERE 1=1 {date_filter.replace('created_at', 'ps.created_at')}
                        GROUP BY DATE(ps.created_at)
                        ORDER BY date DESC
                        LIMIT 30
                    ''', params)
                    
                    daily_trends = [
                        {
                            'date': row[0],
                            'sessions': row[1],
                            'completed': row[2],
                            'avg_duration': row[3]
                        }
                        for row in cursor.fetchall()
                    ]
                
                return {
                    'summary': {
                        'total_sessions': stats[0] or 0,
                        'completed_sessions': stats[1] or 0,
                        'failed_sessions': stats[2] or 0,
                        'success_rate': (stats[1] / stats[0] * 100) if stats[0] > 0 else 0,
                        'avg_duration_seconds': stats[3],
                        'earliest_session': stats[4],
                        'latest_session': stats[5]
                    },
                    'step_analytics': [
                        {
                            'step_id': row[0],
                            'step_name': row[1],
                            'executions': row[2],
                            'avg_duration_seconds': row[3],
                            'total_tokens': row[4],
                            'total_cost': row[5]
                        }
                        for row in step_analytics
                    ],
                    'daily_trends': daily_trends
                }
                
        except Exception as e:
            logger.error(f"Failed to get usage analytics: {e}")
            return {'error': str(e)}
    
    def get_ideas_list(self, page: int = 1, limit: int = 50, status: Optional[str] = None, 
                      search: Optional[str] = None) -> Dict[str, Any]:
        """Get paginated list of processed ideas"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Build filters
                where_clauses = []
                params = []
                
                if status:
                    where_clauses.append("status = ?")
                    params.append(status)
                
                if search:
                    where_clauses.append("original_idea LIKE ?")
                    params.append(f"%{search}%")
                
                where_sql = " AND ".join(where_clauses)
                if where_sql:
                    where_sql = "WHERE " + where_sql
                
                # Get total count
                cursor.execute(f'SELECT COUNT(*) FROM processing_sessions {where_sql}', params)
                total_count = cursor.fetchone()[0]
                
                # Get paginated results
                offset = (page - 1) * limit
                cursor.execute(f'''
                    SELECT 
                        request_id,
                        SUBSTR(original_idea, 1, 200) as idea_preview,
                        status,
                        created_at,
                        completed_at,
                        total_duration_seconds,
                        error_message
                    FROM processing_sessions 
                    {where_sql}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ''', params + [limit, offset])
                
                ideas = [
                    {
                        'request_id': row[0],
                        'idea_preview': row[1] + ('...' if len(row[1]) == 200 else ''),
                        'status': row[2],
                        'created_at': row[3],
                        'completed_at': row[4],
                        'duration_seconds': row[5],
                        'error_message': row[6]
                    }
                    for row in cursor.fetchall()
                ]
                
                total_pages = (total_count + limit - 1) // limit
                
                return {
                    'ideas': ideas,
                    'pagination': {
                        'page': page,
                        'limit': limit,
                        'total_count': total_count,
                        'total_pages': total_pages,
                        'has_next': page < total_pages,
                        'has_prev': page > 1
                    }
                }
                
        except Exception as e:
            logger.error(f"Failed to get ideas list: {e}")
            return {'error': str(e)}
    
    def get_session_details(self, request_id: str) -> Dict[str, Any]:
        """Get complete processing details for specific session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get session info
                cursor.execute('''
                    SELECT request_id, original_idea, created_at, completed_at, status,
                           total_duration_seconds, error_message
                    FROM processing_sessions 
                    WHERE request_id = ?
                ''', (request_id,))
                
                session_row = cursor.fetchone()
                if not session_row:
                    return {'error': 'Session not found'}
                
                session = {
                    'request_id': session_row[0],
                    'original_idea': session_row[1],
                    'created_at': session_row[2],
                    'completed_at': session_row[3],
                    'status': session_row[4],
                    'total_duration_seconds': session_row[5],
                    'error_message': session_row[6]
                }
                
                # Get step outputs
                cursor.execute('''
                    SELECT so.step_id, so.step_name, so.input_text, so.output_text,
                           so.raw_llm_output, so.duration_seconds, so.created_at,
                           so.model_used, so.token_count, so.cost_estimate
                    FROM step_outputs so
                    JOIN processing_sessions ps ON so.session_id = ps.id
                    WHERE ps.request_id = ?
                    ORDER BY so.step_id
                ''', (request_id,))
                
                steps = [
                    {
                        'step_id': row[0],
                        'step_name': row[1],
                        'input_text': row[2],
                        'output_text': row[3],
                        'raw_llm_output': row[4],
                        'duration_seconds': row[5],
                        'created_at': row[6],
                        'model_used': row[7],
                        'token_count': row[8],
                        'cost_estimate': row[9]
                    }
                    for row in cursor.fetchall()
                ]
                
                # Get insights
                cursor.execute('''
                    SELECT i.step_id, i.insight_text, i.insight_label, i.created_at
                    FROM insights i
                    JOIN processing_sessions ps ON i.session_id = ps.id
                    WHERE ps.request_id = ?
                    ORDER BY i.step_id
                ''', (request_id,))
                
                insights = [
                    {
                        'step_id': row[0],
                        'insight_text': row[1],
                        'insight_label': row[2],
                        'created_at': row[3]
                    }
                    for row in cursor.fetchall()
                ]
                
                return {
                    'session': session,
                    'steps': steps,
                    'insights': insights
                }
                
        except Exception as e:
            logger.error(f"Failed to get session details for {request_id}: {e}")
            return {'error': str(e)}

# Global instance
db_service = None

def get_db_service() -> DatabaseService:
    """Get or create database service instance"""
    global db_service
    if db_service is None:
        db_service = DatabaseService()
    return db_service 