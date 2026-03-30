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

    public virtual DbSet<admin_action> admin_actions { get; set; }
    public virtual DbSet<bid> bids { get; set; }
    public virtual DbSet<bid_lock> bid_locks { get; set; }
    public virtual DbSet<bid_transaction> bid_transactions { get; set; }
    public virtual DbSet<handyman_verification> handyman_verifications { get; set; }
    public virtual DbSet<job> jobs { get; set; }
    public virtual DbSet<job_image> job_images { get; set; }
    public virtual DbSet<notification> notifications { get; set; }
    public virtual DbSet<refresh_token> refresh_tokens { get; set; }
    public virtual DbSet<user> users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pgcrypto");

        // --- 1. USER ENTITY (Fixed Column Mappings) ---
        modelBuilder.Entity<user>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id).HasName("users_pkey");

            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
            entity.Property(e => e.Role).HasColumnName("role");
            entity.Property(e => e.IsActive).HasColumnName("account_status").HasDefaultValue(true);

            // THESE TWO LINES FIX THE "AvatarUrl does not exist" ERROR:
            entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
            entity.Property(e => e.Rating).HasColumnName("rating").HasPrecision(3, 2);

            entity.Property(e => e.must_reset_password).HasColumnName("must_reset_password");
            entity.Property(e => e.blocked_reason).HasColumnName("blocked_reason");
            entity.Property(e => e.blocked_at_utc).HasColumnName("blocked_at_utc");
            entity.Property(e => e.blocked_by_user_id).HasColumnName("blocked_by_user_id");
            entity.Property(e => e.CreatedAtUtc).HasColumnName("created_at_utc").HasDefaultValueSql("now()");
            entity.Property(e => e.updated_at_utc).HasColumnName("updated_at_utc").HasDefaultValueSql("now()");

            entity.HasOne(d => d.blocked_by_user).WithMany(p => p.Inverseblocked_by_user)
                .HasForeignKey(d => d.blocked_by_user_id);
        });

        // --- 2. JOB ---
        modelBuilder.Entity<job>(entity =>
        {
            entity.ToTable("jobs");
            entity.HasKey(e => e.id).HasName("jobs_pkey");
            entity.Property(e => e.id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.HasOne(d => d.posted_by_user).WithMany(p => p.jobs).HasForeignKey(d => d.posted_by_user_id);
        });

        // --- 3. BID ---
        modelBuilder.Entity<bid>(entity =>
        {
            entity.ToTable("bids");
            entity.HasKey(e => e.id).HasName("bids_pkey");
            entity.HasOne(d => d.job).WithOne(p => p.bid).HasForeignKey<bid>(d => d.job_id);
            entity.HasOne(d => d.handyman_user).WithMany(p => p.bids).HasForeignKey(d => d.handyman_user_id);
        });

        // --- 4. HANDYMAN VERIFICATION ---
        modelBuilder.Entity<handyman_verification>(entity =>
        {
            entity.ToTable("handyman_verifications");
            entity.HasKey(e => e.id).HasName("handyman_verifications_pkey");
            entity.HasOne(d => d.user).WithOne(p => p.handyman_verificationuser).HasForeignKey<handyman_verification>(d => d.user_id);
            entity.HasOne(d => d.reviewed_by_user).WithMany(p => p.handyman_verificationreviewed_by_users).HasForeignKey(d => d.reviewed_by_user_id);
        });

        // --- 5. BID LOCK ---
        modelBuilder.Entity<bid_lock>(entity =>
        {
            entity.ToTable("bid_locks");
            entity.HasKey(e => e.bid_id).HasName("bid_locks_pkey");
            entity.HasOne(d => d.bid).WithOne(p => p.bid_lock).HasForeignKey<bid_lock>(d => d.bid_id);
            entity.HasOne(d => d.locked_by_user).WithMany(p => p.bid_locks).HasForeignKey(d => d.locked_by_user_id);
        });

        // --- 6. BID TRANSACTION ---
        modelBuilder.Entity<bid_transaction>(entity =>
        {
            entity.ToTable("bid_transactions");
            entity.HasKey(e => e.id).HasName("bid_transactions_pkey");
            entity.HasOne(d => d.handyman_user).WithMany(p => p.bid_transactionhandyman_users).HasForeignKey(d => d.handyman_user_id);
            entity.HasOne(d => d.homeowner_user).WithMany(p => p.bid_transactionhomeowner_users).HasForeignKey(d => d.homeowner_user_id);
            entity.HasOne(d => d.event_by_user).WithMany(p => p.bid_transactionevent_by_users).HasForeignKey(d => d.event_by_user_id);
        });

        // --- 7. OTHERS (Ensuring lowercase tables) ---
        modelBuilder.Entity<notification>(entity => { entity.ToTable("notifications"); entity.HasOne(d => d.user).WithMany(p => p.notifications).HasForeignKey(d => d.user_id); });
        modelBuilder.Entity<refresh_token>(entity => { entity.ToTable("refresh_tokens"); entity.HasOne(d => d.user).WithMany(p => p.refresh_tokens).HasForeignKey(d => d.user_id); });
        modelBuilder.Entity<admin_action>(entity => { entity.ToTable("admin_actions"); entity.HasOne(d => d.admin_user).WithMany(p => p.admin_actions).HasForeignKey(d => d.admin_user_id); });
        modelBuilder.Entity<job_image>(entity => { entity.ToTable("job_images"); entity.HasOne(d => d.job).WithMany(p => p.job_images).HasForeignKey(d => d.job_id); });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
