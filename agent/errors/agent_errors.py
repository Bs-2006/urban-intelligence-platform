class AgentError(Exception): pass
class PlanningError(AgentError): pass
class ToolNotFoundError(AgentError): pass
class ToolExecutionError(AgentError):
    def __init__(self, msg, status_code=None):
        super().__init__(msg)
        self.status_code = status_code
class PermissionDeniedError(AgentError): pass
class ValidationError(AgentError): pass
class ConfirmationRequiredError(AgentError):
    def __init__(self, pending_action):
        super().__init__("Confirmation required")
        self.pending_action = pending_action
class BackendError(AgentError): pass
