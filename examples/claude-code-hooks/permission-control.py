#!/usr/bin/env python3
"""
Permission Control Hook Example
Advanced permission system with role-based access control
This is a Python example showing how non-TypeScript hooks can also work with Claude Code
"""

import json
import sys
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

def load_stdin_json() -> Dict:
    """Load JSON input from stdin (Claude Code protocol)"""
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON input: {e}", file=sys.stderr)
        sys.exit(2)  # Hook failure

def create_hook_output(continue_execution: bool, message: str = "", system_message: str = "") -> Dict:
    """Create Claude Code compatible hook output"""
    return {
        "continue": continue_execution,
        "message": message,
        "systemMessage": system_message
    }

def get_user_role() -> str:
    """Get user role from environment or default to 'user'"""
    return os.environ.get('CLAUDE_USER_ROLE', 'user')

def get_time_restriction() -> Optional[Tuple[int, int]]:
    """Get time restrictions (business hours) as (start_hour, end_hour)"""
    start = os.environ.get('CLAUDE_BUSINESS_START', '9')
    end = os.environ.get('CLAUDE_BUSINESS_END', '17')
    try:
        return (int(start), int(end))
    except ValueError:
        return None

def is_business_hours() -> bool:
    """Check if current time is within business hours"""
    restriction = get_time_restriction()
    if not restriction:
        return True

    current_hour = datetime.now().hour
    start_hour, end_hour = restriction
    return start_hour <= current_hour < end_hour

def check_file_permissions(file_path: str, operation: str, user_role: str) -> Tuple[bool, str]:
    """
    Check file permissions based on path, operation, and user role
    Returns (allowed, reason)
    """

    # Admin role has broader access
    if user_role == 'admin':
        admin_blocked = [
            r'/etc/passwd', r'/etc/shadow', r'/etc/hosts',
            r'\.ssh/id_rsa$', r'\.ssh/.*\.key$'
        ]

        for pattern in admin_blocked:
            if re.search(pattern, file_path):
                return False, f"Even admins cannot access {file_path}"

        # Admins can access most other files
        return True, f"Admin access granted to {file_path}"

    # Developer role restrictions
    if user_role == 'developer':
        dev_allowed = [
            r'\.py$', r'\.js$', r'\.ts$', r'\.json$', r'\.md$',
            r'\.txt$', r'\.yml$', r'\.yaml$', r'\.toml$',
            r'/src/', r'/tests?/', r'/docs?/', r'/examples?/',
        ]

        dev_blocked = [
            r'\.env$', r'\.key$', r'\.pem$', r'\.crt$',
            r'/\.git/', r'/node_modules/', r'/\.ssh/',
            r'/etc/', r'/var/', r'/usr/', r'/sys/', r'/proc/',
            r'package-lock\.json$', r'bun\.lockb$'
        ]

        # Check blocked patterns first
        for pattern in dev_blocked:
            if re.search(pattern, file_path):
                return False, f"Developers cannot access {file_path}"

        # Check allowed patterns
        for pattern in dev_allowed:
            if re.search(pattern, file_path):
                return True, f"Developer access granted to {file_path}"

        # Default deny for developers
        return False, f"File type not allowed for developers: {file_path}"

    # User role (most restrictive)
    if user_role == 'user':
        user_allowed = [
            r'\.md$', r'\.txt$',
            r'/docs/', r'/examples/',
            r'/tmp/', r'/var/tmp/'
        ]

        for pattern in user_allowed:
            if re.search(pattern, file_path):
                return True, f"User access granted to {file_path}"

        return False, f"Users can only access documentation and temporary files"

    # Unknown role - deny access
    return False, f"Unknown user role: {user_role}"

def check_command_permissions(command: str, user_role: str) -> Tuple[bool, str]:
    """
    Check command permissions based on command and user role
    Returns (allowed, reason)
    """

    # Commands allowed for all roles
    safe_commands = [
        r'^echo\s', r'^ls\s', r'^cat\s', r'^head\s', r'^tail\s',
        r'^grep\s', r'^find\s', r'^pwd$', r'^whoami$', r'^date$'
    ]

    for pattern in safe_commands:
        if re.search(pattern, command):
            return True, f"Safe command allowed: {command[:50]}..."

    # Admin commands
    if user_role == 'admin':
        admin_commands = [
            r'^sudo\s', r'^systemctl\s', r'^service\s',
            r'^apt\s', r'^yum\s', r'^brew\s',
            r'^chmod\s', r'^chown\s'
        ]

        for pattern in admin_commands:
            if re.search(pattern, command):
                return True, f"Admin command allowed: {command[:50]}..."

    # Developer commands
    if user_role in ['admin', 'developer']:
        dev_commands = [
            r'^git\s', r'^npm\s', r'^yarn\s', r'^bun\s', r'^node\s',
            r'^python\s', r'^pip\s', r'^cargo\s', r'^rustc\s',
            r'^docker\s', r'^kubectl\s', r'^make\s',
            r'^mkdir\s', r'^mv\s', r'^cp\s', r'^rm\s[^-]'  # rm without dangerous flags
        ]

        for pattern in dev_commands:
            if re.search(pattern, command):
                # Extra safety checks
                if 'rm -rf /' in command or 'rm -rf *' in command:
                    return False, f"Dangerous rm command blocked: {command}"
                return True, f"Developer command allowed: {command[:50]}..."

    # Dangerous commands - blocked for everyone
    dangerous_patterns = [
        r'rm\s+-rf\s+/', r'dd\s+if=', r':\(\)\{.*\}',  # fork bombs
        r'curl.*\|\s*sh', r'wget.*\|\s*sh',
        r'chmod\s+777', r'chown\s+root'
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, command):
            return False, f"Dangerous command blocked: {command}"

    # Default deny
    return False, f"Command not allowed for role {user_role}: {command[:50]}..."

def check_mcp_tool_permissions(tool_name: str, tool_input: Dict, user_role: str) -> Tuple[bool, str]:
    """Check permissions for MCP tools"""

    # Extract MCP provider and tool
    if not tool_name.startswith('mcp__'):
        return True, "Not an MCP tool"

    parts = tool_name.split('__')
    if len(parts) < 3:
        return False, f"Invalid MCP tool name: {tool_name}"

    provider = parts[1]
    mcp_tool = parts[2]

    # Database tools - restricted
    if provider == 'database':
        if user_role != 'admin':
            return False, f"Database access denied for role: {user_role}"

        # Check for dangerous SQL
        query = tool_input.get('query', '')
        dangerous_sql = [
            r'DROP\s+TABLE', r'DELETE\s+FROM.*WHERE\s+1=1',
            r'TRUNCATE\s+TABLE', r'ALTER\s+TABLE.*DROP'
        ]

        for pattern in dangerous_sql:
            if re.search(pattern, query, re.IGNORECASE):
                return False, f"Dangerous SQL query blocked: {query[:50]}..."

    # File system tools
    elif provider == 'filesystem':
        file_path = tool_input.get('path', '')
        allowed, reason = check_file_permissions(file_path, mcp_tool, user_role)
        return allowed, f"MCP filesystem: {reason}"

    # Network tools - business hours only
    elif provider in ['web', 'api', 'http']:
        if not is_business_hours():
            return False, f"Network tools restricted outside business hours"

        if user_role == 'user':
            return False, f"Network access denied for users"

    return True, f"MCP tool {provider}::{mcp_tool} allowed for {user_role}"

def main():
    """Main hook execution"""

    # Load input from Claude Code
    try:
        input_data = load_stdin_json()
    except Exception as e:
        print(f"Failed to load input: {e}", file=sys.stderr)
        sys.exit(2)  # Hook failure

    # Extract context
    session_id = input_data.get('session_id', '')
    hook_event = input_data.get('hook_event_name', '')
    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})
    cwd = input_data.get('cwd', '')

    # Get user role and time info
    user_role = get_user_role()
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    print(f"🔐 Permission check: {tool_name} for role '{user_role}' at {current_time}", file=sys.stderr)

    # Check business hours for non-admin users
    if user_role != 'admin' and not is_business_hours():
        result = create_hook_output(
            False,
            f"Access denied outside business hours for role: {user_role}",
            f"⏰ Current time: {current_time} - Access restricted to business hours"
        )
        print(json.dumps(result))
        return

    # Tool-specific permission checks
    allowed = True
    reason = ""

    if tool_name == 'Bash':
        command = tool_input.get('command', '')
        allowed, reason = check_command_permissions(command, user_role)

    elif tool_name in ['Write', 'Edit', 'MultiEdit', 'Read']:
        file_path = tool_input.get('file_path', '')
        operation = tool_name.lower()
        allowed, reason = check_file_permissions(file_path, operation, user_role)

    elif tool_name.startswith('mcp__'):
        allowed, reason = check_mcp_tool_permissions(tool_name, tool_input, user_role)

    else:
        # Default allow for unknown tools
        allowed = True
        reason = f"Unknown tool {tool_name} - default allow"

    # Create response
    if allowed:
        result = create_hook_output(
            True,
            f"Permission granted: {reason}",
            f"✅ {user_role.title()} access approved for {tool_name}"
        )
    else:
        result = create_hook_output(
            False,
            f"Permission denied: {reason}",
            f"🚫 Access denied for {user_role}"
        )

    # Output result as JSON
    print(json.dumps(result))

if __name__ == '__main__':
    main()