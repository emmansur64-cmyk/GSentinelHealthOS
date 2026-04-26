import pytest

from scripts.qa_validate_buffers import BUFFER_QA_CASES


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize("case_runner", BUFFER_QA_CASES, ids=[case.__name__ for case in BUFFER_QA_CASES])
async def test_buffer_validation_case(case_runner):
    result = await case_runner()
    assert result.passed, result.details
