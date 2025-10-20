"""Simple command-line calculator supporting basic arithmetic operations."""
from __future__ import annotations

import operator
from dataclasses import dataclass
from typing import Callable, Dict


@dataclass(frozen=True)
class Operation:
    name: str
    symbol: str
    function: Callable[[float, float], float]

    def execute(self, left: float, right: float) -> float:
        """Execute the operation on two operands."""
        return self.function(left, right)


class Calculator:
    """Calculator capable of executing registered binary arithmetic operations."""

    def __init__(self) -> None:
        self._operations: Dict[str, Operation] = {}
        self.register_operation("addition", "+", operator.add)
        self.register_operation("subtraction", "-", operator.sub)
        self.register_operation("multiplication", "*", operator.mul)
        self.register_operation("division", "/", self._safe_division)

    def register_operation(self, name: str, symbol: str, func: Callable[[float, float], float]) -> None:
        """Register a new operation for the calculator."""
        key = symbol.lower()
        if key in self._operations:
            raise ValueError(f"Operation '{symbol}' already registered")
        self._operations[key] = Operation(name=name, symbol=symbol, function=func)

    def calculate(self, left: float, symbol: str, right: float) -> float:
        """Calculate the result of applying the operation identified by `symbol`."""
        key = symbol.lower()
        operation = self._operations.get(key)
        if operation is None:
            available = ", ".join(sorted(op.symbol for op in self._operations.values()))
            raise ValueError(f"Unknown operation '{symbol}'. Available: {available}")
        return operation.execute(left, right)

    @staticmethod
    def _safe_division(left: float, right: float) -> float:
        if right == 0:
            raise ZeroDivisionError("Division by zero is not allowed")
        return operator.truediv(left, right)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Simple calculator")
    parser.add_argument("left", type=float, help="Left operand")
    parser.add_argument("symbol", choices=["+", "-", "*", "/"], help="Operation symbol")
    parser.add_argument("right", type=float, help="Right operand")

    args = parser.parse_args()
    calc = Calculator()
    try:
        result = calc.calculate(args.left, args.symbol, args.right)
    except ZeroDivisionError as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")
    print(result)
