_registry: dict[str, dict] = {}

def register(name: str, func, description: str = "", requires_confirmation: bool = False):
    _registry[name] = {"func": func, "description": description, "requires_confirmation": requires_confirmation}

def get_tool(name: str):
    return _registry.get(name)
