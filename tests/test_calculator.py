import math
import pytest

from calculator import Calculator


def test_basic_operations():
    calc = Calculator()
    assert calc.calculate(2, "+", 3) == 5
    assert calc.calculate(5, "-", 2) == 3
    assert calc.calculate(3, "*", 4) == 12
    assert calc.calculate(10, "/", 2) == 5


def test_division_by_zero():
    calc = Calculator()
    with pytest.raises(ZeroDivisionError):
        calc.calculate(5, "/", 0)


def test_unknown_operation():
    calc = Calculator()
    with pytest.raises(ValueError):
        calc.calculate(1, "^", 2)


def test_case_insensitive_symbol_lookup():
    calc = Calculator()
    calc.register_operation("maximum", "M", max)
    assert calc.calculate(2, "M", 3) == 3
    assert calc.calculate(4, "m", 1) == 4


def test_custom_operation():
    calc = Calculator()
    calc.register_operation("power", "^", math.pow)
    assert calc.calculate(2, "^", 3) == 8
