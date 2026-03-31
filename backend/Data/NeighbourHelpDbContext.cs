using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using backend.Models.Entities;

namespace backend.Data;

public partial class NeighbourHelpDbContext : DbContext
{
    public NeighbourHelpDbContext(DbContextOptions<NeighbourHelpDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Admin_Action> Admin_Actions { get; set; }
    public virtual DbSet<Bid> Bids { get; set; }
    public virtual DbSet<Bid_Lock> Bid_Locks { get; set; }
    public virtual DbSet<Bid_Transaction> Bid_Transactions { get; set; }
    public virtual DbSet<Handyman_Verification> Handyman_Verifications { get; set; }
    public virtual DbSet<Job> Jobs { get; set; }
    public virtual DbSet<Job_Image> Job_Images { get; set; }
    public virtual DbSet<Notification> Notifications { get; set; }
    public virtual DbSet<Refresh_Token> Refresh_Tokens { get; set; }
    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // --- 1. USER ENTITY (Fixed Column Mappings) ---
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id).HasName("users_pkey");

            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
            entity.Property(e => e.Role).HasColumnName("role");
            entity.Property(e => e.IsActive).HasColumnName("account_status").HasDefaultValue(true);

            // THESE TWO LINES FIX THE "AvatarUrl does not exist" ERROR:
            entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
            entity.Property(e => e.Rating).HasColumnName("rating").HasPrecision(3, 2);

            entity.Property(e => e.Must_Reset_Password).HasColumnName("must_reset_password");
            entity.Property(e => e.Blocked_Reason).HasColumnName("blocked_reason");
            entity.Property(e => e.Blocked_At_Utc).HasColumnName("blocked_at_utc");
            entity.Property(e => e.Blocked_By_User_Id).HasColumnName("blocked_by_user_id");
            entity.Property(e => e.CreatedAtUtc).HasColumnName("created_at_utc").HasDefaultValueSql("now()");
            entity.Property(e => e.Updated_At_Utc).HasColumnName("updated_at_utc").HasDefaultValueSql("now()");

            entity.HasOne(d => d.Blocked_By_User).WithMany(p => p.Inverse_Blocked_By_User)
                .HasForeignKey(d => d.Blocked_By_User_Id);
        });

        // --- 2. JOB ---
        modelBuilder.Entity<Job>(entity =>
        {
            entity.ToTable("jobs");
            entity.HasKey(e => e.Id).HasName("jobs_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Posted_By_User_Id).HasColumnName("posted_by_user_id");
            entity.Property(e => e.Title).HasColumnName("title");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Category).HasColumnName("category");
            entity.Property(e => e.Location_Text).HasColumnName("location_text");
            entity.Property(e => e.Latitude).HasColumnName("latitude");
            entity.Property(e => e.Longitude).HasColumnName("longitude");
            entity.Property(e => e.Budget).HasColumnName("budget");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Is_Emergency).HasColumnName("is_emergency");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.Property(e => e.Updated_At_Utc).HasColumnName("updated_at_utc");
            entity.HasOne(d => d.Posted_By_User).WithMany(p => p.Jobs).HasForeignKey(d => d.Posted_By_User_Id);
        });

        // --- 3. BID ---
        modelBuilder.Entity<Bid>(entity =>
        {
            entity.ToTable("bids");
            entity.HasKey(e => e.Id).HasName("bids_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Job_Id).HasColumnName("job_id");
            entity.Property(e => e.Handyman_User_Id).HasColumnName("handyman_user_id");
            entity.Property(e => e.Price).HasColumnName("price");
            entity.Property(e => e.Estimated_Arrival_Utc).HasColumnName("estimated_arrival_utc");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Is_Recommended).HasColumnName("is_recommended");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.Property(e => e.Updated_At_Utc).HasColumnName("updated_at_utc");
            entity.HasOne(d => d.Job).WithOne(p => p.Bid).HasForeignKey<Bid>(d => d.Job_Id);
            entity.HasOne(d => d.Handyman_User).WithMany(p => p.Bids).HasForeignKey(d => d.Handyman_User_Id);
        });

        // --- 4. HANDYMAN VERIFICATION ---
        modelBuilder.Entity<Handyman_Verification>(entity =>
        {
            entity.ToTable("handyman_verifications");
            entity.HasKey(e => e.Id).HasName("handyman_verifications_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.User_Id).HasColumnName("user_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Reviewed_By_User_Id).HasColumnName("reviewed_by_user_id");
            entity.Property(e => e.Reviewed_At_Utc).HasColumnName("reviewed_at_utc");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.Property(e => e.Updated_At_Utc).HasColumnName("updated_at_utc");
            entity.HasOne(d => d.User).WithOne(p => p.Handyman_Verification_User).HasForeignKey<Handyman_Verification>(d => d.User_Id);
            entity.HasOne(d => d.Reviewed_By_User).WithMany(p => p.Handyman_Verification_Reviewed_By_Users).HasForeignKey(d => d.Reviewed_By_User_Id);
        });

        // --- 5. BID LOCK ---
        modelBuilder.Entity<Bid_Lock>(entity =>
        {
            entity.ToTable("bid_locks");
            entity.HasKey(e => e.Bid_Id).HasName("bid_locks_pkey");
            entity.Property(e => e.Bid_Id).HasColumnName("bid_id");
            entity.Property(e => e.Locked_By_User_Id).HasColumnName("locked_by_user_id");
            entity.Property(e => e.Locked_Reason).HasColumnName("locked_reason");
            entity.Property(e => e.Locked_At_Utc).HasColumnName("locked_at_utc");
            entity.HasOne(d => d.Bid).WithOne(p => p.Bid_Lock).HasForeignKey<Bid_Lock>(d => d.Bid_Id);
            entity.HasOne(d => d.Locked_By_User).WithMany(p => p.Bid_Locks).HasForeignKey(d => d.Locked_By_User_Id);
        });

        // --- 6. BID TRANSACTION ---
        modelBuilder.Entity<Bid_Transaction>(entity =>
        {
            entity.ToTable("bid_transactions");
            entity.HasKey(e => e.Id).HasName("bid_transactions_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Bid_Id).HasColumnName("bid_id");
            entity.Property(e => e.Job_Id).HasColumnName("job_id");
            entity.Property(e => e.Handyman_User_Id).HasColumnName("handyman_user_id");
            entity.Property(e => e.Homeowner_User_Id).HasColumnName("homeowner_user_id");
            entity.Property(e => e.Event_Type).HasColumnName("event_type");
            entity.Property(e => e.Event_By_User_Id).HasColumnName("event_by_user_id");
            entity.Property(e => e.Event_Reason).HasColumnName("event_reason");
            entity.Property(e => e.Event_Metadata).HasColumnName("event_metadata");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.HasOne(d => d.Handyman_User).WithMany(p => p.Bid_Transaction_Handyman_Users).HasForeignKey(d => d.Handyman_User_Id);
            entity.HasOne(d => d.Homeowner_User).WithMany(p => p.Bid_Transaction_Homeowner_Users).HasForeignKey(d => d.Homeowner_User_Id);
            entity.HasOne(d => d.Event_By_User).WithMany(p => p.Bid_Transaction_Event_By_Users).HasForeignKey(d => d.Event_By_User_Id);
        });

        // --- 7. NOTIFICATION ---
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(e => e.Id).HasName("notifications_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.User_Id).HasColumnName("user_id");
            entity.Property(e => e.Type).HasColumnName("type");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.Related_Job_Id).HasColumnName("related_job_id");
            entity.Property(e => e.Is_Read).HasColumnName("is_read");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.HasOne(d => d.User).WithMany(p => p.Notifications).HasForeignKey(d => d.User_Id);
        });

        // --- 8. REFRESH TOKEN ---
        modelBuilder.Entity<Refresh_Token>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(e => e.Id).HasName("refresh_tokens_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.User_Id).HasColumnName("user_id");
            entity.Property(e => e.Token_Hash).HasColumnName("token_hash");
            entity.Property(e => e.Expires_At_Utc).HasColumnName("expires_at_utc");
            entity.Property(e => e.Revoked_At_Utc).HasColumnName("revoked_at_utc");
            entity.Property(e => e.Replaced_By_Token_Hash).HasColumnName("replaced_by_token_hash");
            entity.Property(e => e.User_Agent).HasColumnName("user_agent");
            entity.Property(e => e.Ip_Address).HasColumnName("ip_address");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.HasOne(d => d.User).WithMany(p => p.Refresh_Tokens).HasForeignKey(d => d.User_Id);
        });

        // --- 9. ADMIN ACTION ---
        modelBuilder.Entity<Admin_Action>(entity =>
        {
            entity.ToTable("admin_actions");
            entity.HasKey(e => e.Id).HasName("admin_actions_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Admin_User_Id).HasColumnName("admin_user_id");
            entity.Property(e => e.Action_Type).HasColumnName("action_type");
            entity.Property(e => e.Target_Type).HasColumnName("target_type");
            entity.Property(e => e.Target_Id).HasColumnName("target_id");
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.Payload).HasColumnName("payload");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.HasOne(d => d.Admin_User).WithMany(p => p.Admin_Actions).HasForeignKey(d => d.Admin_User_Id);
        });

        // --- 10. JOB IMAGE ---
        modelBuilder.Entity<Job_Image>(entity =>
        {
            entity.ToTable("job_images");
            entity.HasKey(e => e.Id).HasName("job_images_pkey");
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Job_Id).HasColumnName("job_id");
            entity.Property(e => e.Image_Url).HasColumnName("image_url");
            entity.Property(e => e.Object_Key).HasColumnName("object_key");
            entity.Property(e => e.Sort_Order).HasColumnName("sort_order");
            entity.Property(e => e.Created_At_Utc).HasColumnName("created_at_utc");
            entity.HasOne(d => d.Job).WithMany(p => p.Job_Images).HasForeignKey(d => d.Job_Id);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
