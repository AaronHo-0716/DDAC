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

        modelBuilder.Entity<admin_action>(entity =>
        {
            entity.HasKey(e => e.id).HasName("admin_actions_pkey");

            entity.HasIndex(e => new { e.admin_user_id, e.created_at_utc }, "ix_admin_actions_actor_created").IsDescending(false, true);

            entity.HasIndex(e => new { e.target_type, e.target_id, e.created_at_utc }, "ix_admin_actions_target").IsDescending(false, false, true);

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.action_type).HasMaxLength(50);
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.payload)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb");
            entity.Property(e => e.target_type).HasMaxLength(50);

            entity.HasOne(d => d.admin_user).WithMany(p => p.admin_actions)
                .HasForeignKey(d => d.admin_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("admin_actions_admin_user_id_fkey");
        });

        modelBuilder.Entity<bid>(entity =>
        {
            entity.HasKey(e => e.id).HasName("bids_pkey");

            entity.HasIndex(e => new { e.handyman_user_id, e.status, e.created_at_utc }, "ix_bids_handyman_status_created").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.job_id, e.status, e.created_at_utc }, "ix_bids_job_status_created").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.job_id, e.handyman_user_id }, "uq_bids_job_handyman").IsUnique();

            entity.HasIndex(e => e.job_id, "uq_bids_one_accepted_per_job")
                .IsUnique()
                .HasFilter("((status)::text = 'accepted'::text)");

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.is_recommended).HasDefaultValue(false);
            entity.Property(e => e.price).HasPrecision(10, 2);
            entity.Property(e => e.status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'pending'::character varying");
            entity.Property(e => e.updated_at_utc).HasDefaultValueSql("now()");

            entity.HasOne(d => d.handyman_user).WithMany(p => p.bids)
                .HasForeignKey(d => d.handyman_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bids_handyman_user_id_fkey");

            entity.HasOne(d => d.job).WithOne(p => p.bid)
                .HasForeignKey<bid>(d => d.job_id)
                .HasConstraintName("bids_job_id_fkey");
        });

        modelBuilder.Entity<bid_lock>(entity =>
        {
            entity.HasKey(e => e.bid_id).HasName("bid_locks_pkey");

            entity.Property(e => e.bid_id).ValueGeneratedNever();
            entity.Property(e => e.locked_at_utc).HasDefaultValueSql("now()");

            entity.HasOne(d => d.bid).WithOne(p => p.bid_lock)
                .HasForeignKey<bid_lock>(d => d.bid_id)
                .HasConstraintName("bid_locks_bid_id_fkey");

            entity.HasOne(d => d.locked_by_user).WithMany(p => p.bid_locks)
                .HasForeignKey(d => d.locked_by_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bid_locks_locked_by_user_id_fkey");
        });

        modelBuilder.Entity<bid_transaction>(entity =>
        {
            entity.HasKey(e => e.id).HasName("bid_transactions_pkey");

            entity.HasIndex(e => new { e.bid_id, e.created_at_utc }, "ix_bid_tx_bid_created").IsDescending(false, true);

            entity.HasIndex(e => new { e.event_type, e.created_at_utc }, "ix_bid_tx_event_type_created").IsDescending(false, true);

            entity.HasIndex(e => new { e.job_id, e.created_at_utc }, "ix_bid_tx_job_created").IsDescending(false, true);

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.event_metadata)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb");
            entity.Property(e => e.event_type).HasMaxLength(50);

            entity.HasOne(d => d.bid).WithMany(p => p.bid_transactions)
                .HasForeignKey(d => d.bid_id)
                .HasConstraintName("bid_transactions_bid_id_fkey");

            entity.HasOne(d => d.event_by_user).WithMany(p => p.bid_transactionevent_by_users)
                .HasForeignKey(d => d.event_by_user_id)
                .HasConstraintName("bid_transactions_event_by_user_id_fkey");

            entity.HasOne(d => d.handyman_user).WithMany(p => p.bid_transactionhandyman_users)
                .HasForeignKey(d => d.handyman_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bid_transactions_handyman_user_id_fkey");

            entity.HasOne(d => d.homeowner_user).WithMany(p => p.bid_transactionhomeowner_users)
                .HasForeignKey(d => d.homeowner_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bid_transactions_homeowner_user_id_fkey");

            entity.HasOne(d => d.job).WithMany(p => p.bid_transactions)
                .HasForeignKey(d => d.job_id)
                .HasConstraintName("bid_transactions_job_id_fkey");
        });

        modelBuilder.Entity<handyman_verification>(entity =>
        {
            entity.HasKey(e => e.id).HasName("handyman_verifications_pkey");

            entity.HasIndex(e => new { e.status, e.created_at_utc }, "ix_verifications_status_created").IsDescending(false, true);

            entity.HasIndex(e => e.user_id, "uq_handyman_verifications_user").IsUnique();

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'pending'::character varying");
            entity.Property(e => e.updated_at_utc).HasDefaultValueSql("now()");

            entity.HasOne(d => d.reviewed_by_user).WithMany(p => p.handyman_verificationreviewed_by_users)
                .HasForeignKey(d => d.reviewed_by_user_id)
                .HasConstraintName("handyman_verifications_reviewed_by_user_id_fkey");

            entity.HasOne(d => d.user).WithOne(p => p.handyman_verificationuser)
                .HasForeignKey<handyman_verification>(d => d.user_id)
                .HasConstraintName("handyman_verifications_user_id_fkey");
        });

        modelBuilder.Entity<job>(entity =>
        {
            entity.HasKey(e => e.id).HasName("jobs_pkey");

            entity.HasIndex(e => new { e.posted_by_user_id, e.created_at_utc }, "ix_jobs_posted_by").IsDescending(false, true);

            entity.HasIndex(e => new { e.status, e.category, e.is_emergency, e.created_at_utc }, "ix_jobs_status_category_emergency_created").IsDescending(false, false, false, true);

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.budget).HasPrecision(10, 2);
            entity.Property(e => e.category).HasMaxLength(50);
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.is_emergency).HasDefaultValue(false);
            entity.Property(e => e.latitude).HasPrecision(9, 6);
            entity.Property(e => e.location_text).HasMaxLength(255);
            entity.Property(e => e.longitude).HasPrecision(9, 6);
            entity.Property(e => e.status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'open'::character varying");
            entity.Property(e => e.title).HasMaxLength(180);
            entity.Property(e => e.updated_at_utc).HasDefaultValueSql("now()");

            entity.HasOne(d => d.posted_by_user).WithMany(p => p.jobs)
                .HasForeignKey(d => d.posted_by_user_id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("jobs_posted_by_user_id_fkey");
        });

        modelBuilder.Entity<job_image>(entity =>
        {
            entity.HasKey(e => e.id).HasName("job_images_pkey");

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.sort_order).HasDefaultValue(0);

            entity.HasOne(d => d.job).WithMany(p => p.job_images)
                .HasForeignKey(d => d.job_id)
                .HasConstraintName("job_images_job_id_fkey");
        });

        modelBuilder.Entity<notification>(entity =>
        {
            entity.HasKey(e => e.id).HasName("notifications_pkey");

            entity.HasIndex(e => new { e.user_id, e.is_read, e.created_at_utc }, "ix_notifications_user_read_created").IsDescending(false, false, true);

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.is_read).HasDefaultValue(false);
            entity.Property(e => e.type).HasMaxLength(50);

            entity.HasOne(d => d.related_job).WithMany(p => p.notifications)
                .HasForeignKey(d => d.related_job_id)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("notifications_related_job_id_fkey");

            entity.HasOne(d => d.user).WithMany(p => p.notifications)
                .HasForeignKey(d => d.user_id)
                .HasConstraintName("notifications_user_id_fkey");
        });

        modelBuilder.Entity<refresh_token>(entity =>
        {
            entity.HasKey(e => e.id).HasName("refresh_tokens_pkey");

            entity.HasIndex(e => new { e.user_id, e.created_at_utc }, "ix_refresh_tokens_user_created").IsDescending(false, true);

            entity.HasIndex(e => e.token_hash, "uq_refresh_tokens_token_hash").IsUnique();

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.ip_address).HasMaxLength(64);

            entity.HasOne(d => d.user).WithMany(p => p.refresh_tokens)
                .HasForeignKey(d => d.user_id)
                .HasConstraintName("refresh_tokens_user_id_fkey");
        });

        modelBuilder.Entity<user>(entity =>
        {
            entity.HasKey(e => e.id).HasName("users_pkey");

            entity.HasIndex(e => e.created_at_utc, "ix_users_created").IsDescending();

            entity.HasIndex(e => new { e.role, e.account_status }, "ix_users_role_status");

            entity.HasIndex(e => e.email, "uq_users_email").IsUnique();

            entity.Property(e => e.id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.account_status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'active'::character varying");
            entity.Property(e => e.created_at_utc).HasDefaultValueSql("now()");
            entity.Property(e => e.email).HasMaxLength(320);
            entity.Property(e => e.must_reset_password).HasDefaultValue(false);
            entity.Property(e => e.name).HasMaxLength(120);
            entity.Property(e => e.rating).HasPrecision(3, 2);
            entity.Property(e => e.role).HasMaxLength(20);
            entity.Property(e => e.updated_at_utc).HasDefaultValueSql("now()");

            entity.HasOne(d => d.blocked_by_user).WithMany(p => p.Inverseblocked_by_user)
                .HasForeignKey(d => d.blocked_by_user_id)
                .HasConstraintName("users_blocked_by_user_id_fkey");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
