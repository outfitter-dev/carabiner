#!/usr/bin/env python3
"""
Context Injection Hook Example - SessionStart Event
Demonstrates how to inject context and setup information when Claude Code sessions begin
This shows advanced session management and context preparation techniques
"""

import json
import sys
import os
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

def load_stdin_json() -> Dict:
    """Load JSON input from stdin (Claude Code protocol)"""
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON input: {e}", file=sys.stderr)
        sys.exit(2)  # Hook failure

def create_hook_output(continue_execution: bool, message: str = "", system_message: str = "") -> Dict:
    """Create Claude Code compatible hook output with context injection"""
    return {
        "continue": continue_execution,
        "message": message,
        "systemMessage": system_message
    }

def get_git_info(cwd: str) -> Dict[str, Any]:
    """Get git repository information"""
    try:
        result = subprocess.run(['git', 'status', '--porcelain'],
                               cwd=cwd, capture_output=True, text=True, timeout=5)

        if result.returncode == 0:
            modified_files = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    status = line[:2]
                    filepath = line[3:]
                    modified_files.append({'status': status, 'file': filepath})

            # Get current branch
            branch_result = subprocess.run(['git', 'branch', '--show-current'],
                                         cwd=cwd, capture_output=True, text=True, timeout=5)
            current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else 'unknown'

            # Get last commit
            commit_result = subprocess.run(['git', 'log', '-1', '--oneline'],
                                         cwd=cwd, capture_output=True, text=True, timeout=5)
            last_commit = commit_result.stdout.strip() if commit_result.returncode == 0 else 'unknown'

            return {
                'is_git_repo': True,
                'current_branch': current_branch,
                'last_commit': last_commit,
                'modified_files': modified_files,
                'has_changes': len(modified_files) > 0
            }
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        pass

    return {'is_git_repo': False}

def get_project_info(cwd: str) -> Dict[str, Any]:
    """Analyze project structure and dependencies"""
    project_info = {
        'project_type': 'unknown',
        'package_files': [],
        'config_files': [],
        'has_tests': False,
        'framework': None
    }

    cwd_path = Path(cwd)

    # Check for common project files
    project_files = {
        'package.json': 'node',
        'Cargo.toml': 'rust',
        'pyproject.toml': 'python',
        'requirements.txt': 'python',
        'go.mod': 'go',
        'pom.xml': 'java',
        'build.gradle': 'java',
        'composer.json': 'php'
    }

    for filename, project_type in project_files.items():
        if (cwd_path / filename).exists():
            project_info['project_type'] = project_type
            project_info['package_files'].append(filename)
            break

    # Check for config files
    config_patterns = [
        '*.json', '*.yaml', '*.yml', '*.toml', '*.ini', '*.conf',
        '.env*', 'tsconfig.*', 'vite.config.*', 'webpack.config.*'
    ]

    for pattern in config_patterns:
        for config_file in cwd_path.glob(pattern):
            if config_file.is_file():
                project_info['config_files'].append(config_file.name)

    # Check for test directories/files
    test_indicators = ['test', 'tests', '__tests__', 'spec', '__pycache__']
    for indicator in test_indicators:
        if (cwd_path / indicator).exists():
            project_info['has_tests'] = True
            break

    # Detect frameworks
    if project_info['project_type'] == 'node':
        package_json = cwd_path / 'package.json'
        if package_json.exists():
            try:
                with open(package_json) as f:
                    package_data = json.load(f)
                    dependencies = {**package_data.get('dependencies', {}),
                                   **package_data.get('devDependencies', {})}

                    if 'react' in dependencies:
                        project_info['framework'] = 'React'
                    elif 'vue' in dependencies:
                        project_info['framework'] = 'Vue'
                    elif 'angular' in dependencies or '@angular/core' in dependencies:
                        project_info['framework'] = 'Angular'
                    elif 'svelte' in dependencies:
                        project_info['framework'] = 'Svelte'
                    elif 'next' in dependencies:
                        project_info['framework'] = 'Next.js'
                    elif 'nuxt' in dependencies:
                        project_info['framework'] = 'Nuxt'
                    elif 'express' in dependencies:
                        project_info['framework'] = 'Express'
                    elif 'fastify' in dependencies:
                        project_info['framework'] = 'Fastify'
                    elif 'hono' in dependencies:
                        project_info['framework'] = 'Hono'
            except (json.JSONDecodeError, FileNotFoundError):
                pass

    return project_info

def get_security_context(cwd: str) -> Dict[str, Any]:
    """Analyze security-related aspects of the project"""
    security_info = {
        'sensitive_files': [],
        'security_tools': [],
        'env_files': [],
        'risk_level': 'low'
    }

    cwd_path = Path(cwd)

    # Check for sensitive files
    sensitive_patterns = [
        '*.key', '*.pem', '*.crt', '*.p12', '*.jks',
        '.env*', '*secret*', '*password*', '*token*',
        '.ssh/*', '.aws/*', '.gcp/*'
    ]

    for pattern in sensitive_patterns:
        for sensitive_file in cwd_path.rglob(pattern):
            if sensitive_file.is_file():
                security_info['sensitive_files'].append(str(sensitive_file.relative_to(cwd_path)))

    # Check for security tools
    security_tools = [
        '.eslintrc*', '.prettierrc*', 'sonar-project.properties',
        'security.md', 'SECURITY.md', '.security/*'
    ]

    for tool in security_tools:
        for tool_file in cwd_path.glob(tool):
            if tool_file.exists():
                security_info['security_tools'].append(tool_file.name)

    # Determine risk level
    if len(security_info['sensitive_files']) > 5:
        security_info['risk_level'] = 'high'
    elif len(security_info['sensitive_files']) > 2:
        security_info['risk_level'] = 'medium'

    return security_info

def get_development_context(cwd: str) -> Dict[str, Any]:
    """Get development environment context"""
    dev_info = {
        'docker_present': False,
        'ci_present': False,
        'docs_present': False,
        'scripts': [],
        'development_stage': 'unknown'
    }

    cwd_path = Path(cwd)

    # Check for Docker
    if (cwd_path / 'Dockerfile').exists() or (cwd_path / 'docker-compose.yml').exists():
        dev_info['docker_present'] = True

    # Check for CI/CD
    ci_indicators = ['.github/workflows', '.gitlab-ci.yml', '.circleci', 'Jenkinsfile']
    for indicator in ci_indicators:
        if (cwd_path / indicator).exists():
            dev_info['ci_present'] = True
            break

    # Check for documentation
    doc_indicators = ['README.md', 'docs/', 'documentation/', 'wiki/']
    for indicator in doc_indicators:
        if (cwd_path / indicator).exists():
            dev_info['docs_present'] = True
            break

    # Get available scripts from package.json
    package_json = cwd_path / 'package.json'
    if package_json.exists():
        try:
            with open(package_json) as f:
                package_data = json.load(f)
                scripts = package_data.get('scripts', {})
                dev_info['scripts'] = list(scripts.keys())
        except (json.JSONDecodeError, FileNotFoundError):
            pass

    # Determine development stage
    if dev_info['ci_present'] and dev_info['docs_present'] and dev_info['docker_present']:
        dev_info['development_stage'] = 'mature'
    elif dev_info['ci_present'] or dev_info['docs_present']:
        dev_info['development_stage'] = 'intermediate'
    else:
        dev_info['development_stage'] = 'early'

    return dev_info

def create_context_summary(git_info: Dict, project_info: Dict, security_info: Dict, dev_info: Dict, session_id: str) -> str:
    """Create a comprehensive context summary for Claude"""

    summary_parts = []

    # Session info
    summary_parts.append(f"🚀 **Claude Code Session Started**")
    summary_parts.append(f"Session ID: `{session_id}`")
    summary_parts.append(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    summary_parts.append("")

    # Project context
    summary_parts.append("## 📁 Project Context")
    if project_info['project_type'] != 'unknown':
        summary_parts.append(f"- **Project Type**: {project_info['project_type'].title()}")
        if project_info['framework']:
            summary_parts.append(f"- **Framework**: {project_info['framework']}")

    if project_info['package_files']:
        summary_parts.append(f"- **Package Files**: {', '.join(project_info['package_files'])}")

    if project_info['has_tests']:
        summary_parts.append("- **Tests**: ✅ Test suite detected")

    summary_parts.append("")

    # Git context
    if git_info['is_git_repo']:
        summary_parts.append("## 🔄 Git Repository")
        summary_parts.append(f"- **Current Branch**: `{git_info['current_branch']}`")
        summary_parts.append(f"- **Last Commit**: {git_info['last_commit']}")

        if git_info['has_changes']:
            summary_parts.append(f"- **Status**: ⚠️ {len(git_info['modified_files'])} modified files")
            for file_info in git_info['modified_files'][:5]:  # Show up to 5 files
                summary_parts.append(f"  - {file_info['status']} {file_info['file']}")
            if len(git_info['modified_files']) > 5:
                summary_parts.append(f"  - ... and {len(git_info['modified_files']) - 5} more files")
        else:
            summary_parts.append("- **Status**: ✅ Working directory clean")
        summary_parts.append("")

    # Security context
    if security_info['sensitive_files'] or security_info['risk_level'] != 'low':
        summary_parts.append("## 🔒 Security Context")
        summary_parts.append(f"- **Risk Level**: {security_info['risk_level'].title()}")

        if security_info['sensitive_files']:
            summary_parts.append(f"- **Sensitive Files Detected**: {len(security_info['sensitive_files'])} files")
            summary_parts.append("  - Extra caution required when accessing these files")

        if security_info['security_tools']:
            summary_parts.append(f"- **Security Tools**: {', '.join(security_info['security_tools'])}")

        summary_parts.append("")

    # Development context
    summary_parts.append("## 🛠️ Development Environment")
    summary_parts.append(f"- **Development Stage**: {dev_info['development_stage'].title()}")

    features = []
    if dev_info['docker_present']:
        features.append("🐳 Docker")
    if dev_info['ci_present']:
        features.append("⚙️ CI/CD")
    if dev_info['docs_present']:
        features.append("📖 Documentation")

    if features:
        summary_parts.append(f"- **Features**: {' | '.join(features)}")

    if dev_info['scripts']:
        summary_parts.append(f"- **Available Scripts**: {', '.join(dev_info['scripts'][:8])}")
        if len(dev_info['scripts']) > 8:
            summary_parts.append(f"  - ... and {len(dev_info['scripts']) - 8} more scripts")

    summary_parts.append("")

    # Guidelines and reminders
    summary_parts.append("## 💡 Session Guidelines")

    if security_info['risk_level'] == 'high':
        summary_parts.append("- ⚠️ **High security risk project** - be extra cautious with file operations")

    if git_info.get('has_changes'):
        summary_parts.append("- 🔄 **Uncommitted changes detected** - consider creating a backup before major operations")

    if project_info['has_tests']:
        summary_parts.append("- 🧪 **Run tests after changes** - test suite is available")

    if dev_info['scripts']:
        summary_parts.append("- 📋 **Use project scripts** - npm/yarn/bun scripts are configured")

    summary_parts.append("- 🤖 **AI Assistant Active** - Carabiner security hooks are monitoring all operations")

    return "\n".join(summary_parts)

def main():
    """Main hook execution for SessionStart event"""

    # Load input from Claude Code
    try:
        input_data = load_stdin_json()
    except Exception as e:
        print(f"Failed to load input: {e}", file=sys.stderr)
        sys.exit(2)  # Hook failure

    # Extract context
    session_id = input_data.get('session_id', '')
    hook_event = input_data.get('hook_event_name', '')
    cwd = input_data.get('cwd', os.getcwd())

    # Only process SessionStart events
    if hook_event != 'SessionStart':
        result = create_hook_output(True, "Not a SessionStart event", "")
        print(json.dumps(result))
        return

    print(f"🚀 Initializing Claude Code session: {session_id}", file=sys.stderr)
    print(f"📁 Working directory: {cwd}", file=sys.stderr)

    try:
        # Gather comprehensive context
        git_info = get_git_info(cwd)
        project_info = get_project_info(cwd)
        security_info = get_security_context(cwd)
        dev_info = get_development_context(cwd)

        # Create comprehensive context summary
        context_summary = create_context_summary(git_info, project_info, security_info, dev_info, session_id)

        # Create response with injected context
        result = create_hook_output(
            True,
            f"Session {session_id} initialized with project context",
            context_summary
        )

        print(json.dumps(result))

        # Log session start for audit
        audit_entry = {
            'timestamp': datetime.now().isoformat(),
            'event': 'session_start',
            'session_id': session_id,
            'cwd': cwd,
            'project_type': project_info['project_type'],
            'framework': project_info.get('framework'),
            'git_repo': git_info['is_git_repo'],
            'security_risk': security_info['risk_level'],
            'development_stage': dev_info['development_stage']
        }

        # Write audit log
        audit_file = f"/tmp/claude-sessions-{datetime.now().strftime('%Y-%m')}.log"
        with open(audit_file, 'a') as f:
            f.write(json.dumps(audit_entry) + '\n')

        print(f"📊 Session audit logged to {audit_file}", file=sys.stderr)

    except Exception as e:
        print(f"Error during context analysis: {e}", file=sys.stderr)
        # Provide basic context even if analysis fails
        basic_context = f"""
🚀 **Claude Code Session Started**
Session ID: `{session_id}`
Working Directory: `{cwd}`

⚠️ Advanced context analysis failed, but session is ready.
Basic security and monitoring hooks are active.
        """.strip()

        result = create_hook_output(
            True,
            "Session initialized with basic context (analysis error)",
            basic_context
        )
        print(json.dumps(result))

if __name__ == '__main__':
    main()