class ProviderRouterError(Exception):
    def __init__(self, message: str, code: str, blocked_by_policy: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.blocked_by_policy = blocked_by_policy
