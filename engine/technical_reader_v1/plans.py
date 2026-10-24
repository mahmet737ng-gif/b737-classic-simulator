"""Explicit, ordered chart/table/formula calculation chains and corrections."""
from .numeric import ReaderError, finite


def calculate_plan(store, steps, inputs, *, context=None, mode="validated"):
    """Bindings are {'input': name}, {'step': id}, or {'constant': numeric_value}.

    Correction signs and ordering come from the reviewed plan, never OCR guesses.
    Earlier steps remain audited if a later step fails; no final result is returned.
    """
    results = {}
    for step in steps:
        ident = step["id"]
        if ident in results:
            raise ReaderError("Duplicate calculation step")
        values = {}
        for name, binding in step["bindings"].items():
            if len(binding) != 1:
                raise ReaderError("A binding requires exactly one source")
            if "input" in binding:
                if binding["input"] not in inputs:
                    raise ReaderError("Missing plan input")
                values[name] = inputs[binding["input"]]
            elif "step" in binding:
                if binding["step"] not in results:
                    raise ReaderError("Unknown/forward step reference")
                values[name] = results[binding["step"]]["value"]
                # The binding explicitly pins the expected unit to avoid mixing correction units.
                if binding["step"] not in step.get("expected_units", {}):
                    raise ReaderError("Step output unit contract required")
                if results[binding["step"]]["unit"] != step["expected_units"][binding["step"]]:
                    raise ReaderError("Plan output/input unit mismatch")
                model = store.get_model(step["model_id"], step["revision"])
                target_unit = next(d["unit"] for d in model["inputs"] if d["name"] == name)
                if target_unit != results[binding["step"]]["unit"]:
                    raise ReaderError("Explicit conversion model required between different units")
            elif "constant" in binding:
                values[name] = finite(binding["constant"])
            else:
                raise ReaderError("Unknown binding kind")
        results[ident] = store.calculate(step["model_id"], step["revision"], values, context=context, mode=mode)
    if not results:
        raise ReaderError("Empty calculation plan")
    final = list(results.values())[-1]
    return {"value": final["value"], "unit": final["unit"], "steps": results,
            "uncertainty_known": False,
            "limitation": "Plan-level uncertainty propagation is not implemented; inspect individual step bounds."}
