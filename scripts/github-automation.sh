#!/bin/bash

# GitHub Automation Script for Lab Coffee Ticket App
# This script automates the GitHub workflow: Issue → Branch → Implementation → PR

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

# Function to create an issue
create_issue() {
    local title="$1"
    local description="$2"
    local labels="${3:-enhancement}"

    print_info "Creating GitHub Issue: '$title'"

    # Create the issue and capture the issue number
    local issue_output=$(gh issue create \
        --title "$title" \
        --body "$description" \
        --label "$labels" 2>&1)

    # Extract issue number from output (format: "https://github.com/owner/repo/issues/123")
    local issue_number=$(echo "$issue_output" | grep -oP '(?<=/issues/)\d+' | head -1)

    if [ -z "$issue_number" ]; then
        print_error "Failed to create issue"
        return 1
    fi

    print_success "Issue created: #$issue_number"
    echo "$issue_number"
}

# Function to create a branch
create_branch() {
    local issue_number="$1"
    local feature_name="$2"
    local remote="${3:-origin}"

    # Sanitize feature name (replace spaces with hyphens, remove special chars)
    feature_name=$(echo "$feature_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/-+/-/g' | sed 's/^-\|-$//')

    local branch_name="feature/issue-${issue_number}-${feature_name}"

    print_info "Creating branch: '$branch_name'"

    # Create and checkout the branch
    git checkout -b "$branch_name" 2>&1 || {
        print_error "Failed to create branch"
        return 1
    }

    # Push the branch to remote
    git push -u "$remote" "$branch_name" 2>&1 || {
        print_error "Failed to push branch to remote '$remote'"
        return 1
    }

    print_success "Branch created and pushed: $branch_name"
    echo "$branch_name"
}

# Function to create a PR
create_pr() {
    local branch_name="$1"
    local issue_number="$2"

    print_info "Creating Pull Request for branch: '$branch_name'"

    # Create the PR with automatic linking to the issue
    local pr_output=$(gh pr create \
        --title "Implement feature for issue #$issue_number" \
        --body "Closes #$issue_number" \
        --base main \
        --head "$branch_name" 2>&1)

    # Extract PR number from output
    local pr_number=$(echo "$pr_output" | grep -oP '(?<=/pull/)\d+' | head -1)

    if [ -z "$pr_number" ]; then
        print_error "Failed to create PR"
        return 1
    fi

    print_success "Pull Request created: #$pr_number"
    echo "$pr_number"
}

# Function to show usage
show_usage() {
    cat << EOF
${BLUE}GitHub Automation Script - Lab Coffee Ticket App${NC}

Usage:
    $0 <command> [options]

Commands:
    issue <title> <description> [labels]
        Create a new GitHub issue
        Example: $0 issue "Add user authentication" "Implement OAuth login flow" "feature"

    branch <issue_number> <feature_name> [remote]
        Create a feature branch from an issue
        Example: $0 branch 42 "user authentication" "origin"

    pr <branch_name> <issue_number>
        Create a pull request
        Example: $0 pr "feature/issue-42-user-authentication" 42

    workflow <title> <description> [labels] [remote]
        Complete workflow: Create issue → Create branch → Show next steps
        Example: $0 workflow "Add user authentication" "Implement OAuth login flow" "feature" "origin"

    help
        Show this help message

Examples:
    # Create an issue
    $0 issue "Add QR code scanning" "Implement QR code scanning for ticket usage"

    # Create a branch for the issue
    $0 branch 5 "QR code scanning"

    # Create a PR
    $0 pr "feature/issue-5-qr-code-scanning" 5

    # Complete workflow
    $0 workflow "Add QR code scanning" "Implement QR code scanning for ticket usage"

EOF
}

# Main script logic
main() {
    local command="$1"

    case "$command" in
        issue)
            if [ -z "$2" ] || [ -z "$3" ]; then
                print_error "Missing arguments for 'issue' command"
                show_usage
                exit 1
            fi
            create_issue "$2" "$3" "${4:-enhancement}"
            ;;
        branch)
            if [ -z "$2" ] || [ -z "$3" ]; then
                print_error "Missing arguments for 'branch' command"
                show_usage
                exit 1
            fi
            create_branch "$2" "$3" "${4:-origin}"
            ;;
        pr)
            if [ -z "$2" ] || [ -z "$3" ]; then
                print_error "Missing arguments for 'pr' command"
                show_usage
                exit 1
            fi
            create_pr "$2" "$3"
            ;;
        workflow)
            if [ -z "$2" ] || [ -z "$3" ]; then
                print_error "Missing arguments for 'workflow' command"
                show_usage
                exit 1
            fi
            print_info "Starting complete GitHub workflow..."
            issue_number=$(create_issue "$2" "$3" "${4:-enhancement}")
            if [ $? -eq 0 ]; then
                print_info ""
                # Automatically create branch after issue creation
                branch_name=$(create_branch "$issue_number" "$2" "${5:-origin}")
                if [ $? -eq 0 ]; then
                    print_info ""
                    print_success "Workflow completed successfully!"
                    print_info ""
                    print_info "Next steps:"
                    print_info "1. Implement the feature on the created branch: $branch_name"
                    print_info "2. Commit your changes: git commit -m 'Implement feature for issue #$issue_number'"
                    print_info "3. Push your changes: git push"
                    print_info "4. Create a PR: $0 pr \"$branch_name\" $issue_number"
                else
                    print_warning "Issue created (#$issue_number) but branch creation failed"
                    print_info "Create the branch manually: $0 branch $issue_number \"$2\""
                fi
            fi
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: '$command'"
            show_usage
            exit 1
            ;;
    esac
}

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first."
    print_info "Visit: https://cli.github.com"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Run main function with all arguments
main "$@"
