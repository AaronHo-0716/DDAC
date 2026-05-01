using backend.Models.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/bank-details")]
[Authorize(Roles = "admin")]
public class AdminBankDetailsController(IHandymanBankService handymanBankService) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<AdminBankDetailsResponse>> GetBankDetails(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try { return Ok(await handymanBankService.GetAllBankDetailsAsync(status, page, pageSize)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("{bankDetailsId}/approve")]
    public async Task<ActionResult<AdminBankDetailsDto>> ApproveBankDetails(Guid bankDetailsId)
    {
        try { return Ok(await handymanBankService.ApproveBankDetailsAsync(bankDetailsId)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    [HttpPatch("{bankDetailsId}/reject")]
    public async Task<ActionResult<AdminBankDetailsDto>> RejectBankDetails(
        Guid bankDetailsId,
        [FromBody] RejectBankDetailsRequest request)
    {
        try { return Ok(await handymanBankService.RejectBankDetailsAsync(bankDetailsId, request)); }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}
