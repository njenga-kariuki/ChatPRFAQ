from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    """Base for every model the council returns.

    `extra="forbid"` makes Pydantic emit `additionalProperties: false`, which the
    structured-outputs API requires on every object. Output schemas deliberately
    avoid numeric or string constraints (min/max/length) because the API does not
    support them; ranges are validated in Python after parsing instead.
    """

    model_config = ConfigDict(extra="forbid")


def output_schema(model: type[BaseModel]) -> dict:
    """JSON schema in the shape `output_config.format` expects."""
    schema = model.model_json_schema()
    schema.pop("title", None)
    return schema
