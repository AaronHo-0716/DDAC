using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using backend.Models.DTOs;

namespace backend.Controllers;

[ApiController]
[Route("api/bank-details")]
[Authorize(Roles = "handyman")]
public class HandymanBankDetailsController(IHandymanBankService handymanBankService) : BaseController
{
    /// <summary>
    /// Get current bank details for authenticated handyman
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<BankDetailsDto>> GetBankDetails()
    {
        try
        {
            var details = await handymanBankService.GetBankDetailsAsync();
            if (details == null)
                return NotFound(new { message = "Bank details not found" });
            return Ok(details);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Add new bank details
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<BankDetailsDto>> AddBankDetails([FromBody] CreateBankDetailsRequest request)
    {
        try
        {
            var details = await handymanBankService.AddBankDetailsAsync(request);
            return CreatedAtAction(nameof(GetBankDetails), details);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Delete existing bank details
    /// </summary>
    [HttpDelete]
    public async Task<ActionResult> DeleteBankDetails()
    {
        try
        {
            await handymanBankService.DeleteBankDetailsAsync();
            return NoContent();
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Upload bank statement proof document
    /// </summary>
    // [HttpPost("proof/upload")]
    // public async Task<ActionResult<BankDetailsDto>> UploadProof(IFormFile file)
    // {
    //     try
    //     {
    //         if (file == null || file.Length == 0)
    //             return BadRequest(new { message = "No file uploaded" });

    //         var details = await handymanBankService.UploadBankStatementProofAsync(file);
    //         return Ok(details);
    //     }
    //     catch (HttpRequestException ex) { return HandleError(ex); }
    // }

    /// <summary>
    /// Get credit balance summary
    /// </summary>
    [HttpGet("credits/balance")]
    public async Task<ActionResult<CreditBalanceDto>> GetCreditBalance()
    {
        try
        {
            var balance = await handymanBankService.GetCreditBalanceAsync();
            return Ok(balance);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Get credit transaction history (paginated)
    /// </summary>
    [HttpGet("credits/transactions")]
    public async Task<ActionResult<CreditTransactionsResponse>> GetCreditTransactions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var response = await handymanBankService.GetCreditTransactionsAsync(page, pageSize);
            return Ok(response);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Request a withdrawal of earned credits
    /// </summary>
    [HttpPost("withdrawals/request")]
    public async Task<ActionResult<WithdrawalRequestDto>> RequestWithdrawal([FromBody] CreateWithdrawalRequestRequest request)
    {
        try
        {
            var withdrawal = await handymanBankService.RequestWithdrawalAsync(request);
            return CreatedAtAction(nameof(GetWithdrawalRequests), withdrawal);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }

    /// <summary>
    /// Get withdrawal request history (paginated)
    /// </summary>
    [HttpGet("withdrawals")]
    public async Task<ActionResult<WithdrawalRequestsResponse>> GetWithdrawalRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var response = await handymanBankService.GetWithdrawalRequestsAsync(page, pageSize);
            return Ok(response);
        }
        catch (HttpRequestException ex) { return HandleError(ex); }
    }
}
