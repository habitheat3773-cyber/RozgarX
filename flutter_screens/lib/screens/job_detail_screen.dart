// ============================================================
// ROZGARX - lib/screens/job_detail_screen.dart
// Full Job Details Page
// ============================================================

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/job_model.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/detail_row.dart';
import '../widgets/interstitial_ad_manager.dart';

class JobDetailScreen extends StatefulWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  JobModel? _job;
  bool _isLoading = true;
  bool _isSaved = false;

  @override
  void initState() {
    super.initState();
    _loadJob();
    InterstitialAdManager.show(); // Show ad when opening job details
  }

  Future<void> _loadJob() async {
    try {
      final data = await ApiService.get('/jobs/${widget.jobId}', auth: false);
      setState(() {
        _job = JobModel.fromJson(data);
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return _buildLoadingScreen();
    if (_job == null) return _buildErrorScreen();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(),
          SliverToBoxAdapter(child: _buildContent()),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 180,
      pinned: true,
      backgroundColor: AppTheme.primaryBlue,
      actions: [
        IconButton(
          icon: Icon(_isSaved ? Icons.bookmark : Icons.bookmark_border,
              color: Colors.white),
          onPressed: _toggleSave,
        ),
        IconButton(
          icon: const Icon(Icons.share, color: Colors.white),
          onPressed: _shareJob,
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppTheme.primaryBlue, AppTheme.primaryBlueDark],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(16, 80, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (_job!.isFeatured)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('⭐ FEATURED',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              Text(
                _job!.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Poppins',
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                _job!.organization ?? _job!.department ?? '',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick Info Cards
          _buildQuickInfoRow(),
          const SizedBox(height: 20),

          // Deadline Badge
          if (_job!.lastDate != null) _buildDeadlineBadge(),
          const SizedBox(height: 20),

          // Important Dates
          _buildSection('📅 Important Dates', [
            if (_job!.lastDate != null)
              DetailRow(
                label: 'Last Date',
                value: DateFormat('dd MMM yyyy').format(_job!.lastDate!),
                isImportant: _job!.isDeadlineNear,
              ),
          ]),

          // Job Details
          _buildSection('📋 Job Details', [
            if (_job!.vacancies != null)
              DetailRow(label: 'Total Vacancies', value: '${_job!.vacancies} Posts'),
            if (_job!.qualification != null)
              DetailRow(label: 'Qualification', value: _job!.qualification!),
            if (_job!.ageMin != null || _job!.ageMax != null)
              DetailRow(
                  label: 'Age Limit',
                  value: '${_job!.ageMin ?? 18}-${_job!.ageMax ?? 40} Years'),
            DetailRow(label: 'Category', value: _job!.category.toUpperCase()),
            DetailRow(label: 'Location', value: _job!.state ?? 'All India'),
          ]),

          // Salary
          _buildSection('💰 Salary', [
            DetailRow(label: 'Pay Scale', value: _job!.displaySalary),
          ]),

          // Application Fee
          if (_job!.applicationFee != null)
            _buildSection('💳 Application Fee', [
              DetailRow(label: 'Fee', value: _job!.applicationFee!),
            ]),

          // Selection Process
          if (_job!.selectionProcess != null && _job!.selectionProcess!.isNotEmpty)
            _buildTextSection('🎯 Selection Process', _job!.selectionProcess!),

          // Description
          if (_job!.fullDescription != null && _job!.fullDescription!.isNotEmpty)
            _buildTextSection('ℹ️ About This Job', _job!.fullDescription!),

          // Exam Pattern
          if (_job!.examPattern != null && _job!.examPattern!.isNotEmpty)
            _buildTextSection('📝 Exam Pattern', _job!.examPattern!),

          // Download PDF
          if (_job!.pdfUrl != null) _buildPdfDownload(),

          const SizedBox(height: 100),
        ],
      ),
    );
  }

  Widget _buildQuickInfoRow() {
    return Row(
      children: [
        _QuickInfoCard(
          icon: Icons.people_alt_outlined,
          label: 'Vacancies',
          value: _job!.vacancies?.toString() ?? 'N/A',
          color: AppTheme.primaryBlue,
        ),
        const SizedBox(width: 12),
        _QuickInfoCard(
          icon: Icons.currency_rupee,
          label: 'Salary',
          value: _job!.salaryMin != null ? '${(_job!.salaryMin! / 1000).round()}K+' : 'N/A',
          color: AppTheme.success,
        ),
        const SizedBox(width: 12),
        _QuickInfoCard(
          icon: Icons.location_on_outlined,
          label: 'State',
          value: (_job!.state ?? 'All India').length > 8
              ? '${(_job!.state ?? 'All India').substring(0, 8)}..'
              : (_job!.state ?? 'All India'),
          color: AppTheme.accentOrange,
        ),
      ],
    );
  }

  Widget _buildDeadlineBadge() {
    final daysLeft = _job!.lastDate!.difference(DateTime.now()).inDays;
    final isUrgent = daysLeft <= 3;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isUrgent
            ? AppTheme.error.withOpacity(0.1)
            : AppTheme.warning.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isUrgent ? AppTheme.error : AppTheme.warning,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            isUrgent ? Icons.warning_amber_rounded : Icons.schedule,
            color: isUrgent ? AppTheme.error : AppTheme.warning,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(
            daysLeft <= 0
                ? '⚠️ Last day to apply!'
                : daysLeft == 1
                    ? '⚠️ Only 1 day left!'
                    : isUrgent
                        ? '⚠️ Only $daysLeft days left!'
                        : '📅 $daysLeft days remaining to apply',
            style: TextStyle(
              color: isUrgent ? AppTheme.error : AppTheme.warning,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> rows) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(title, style: AppTheme.heading3),
          ),
          const Divider(height: 1),
          ...rows,
        ],
      ),
    );
  }

  Widget _buildTextSection(String title, String content) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTheme.heading3),
          const SizedBox(height: 8),
          Text(content, style: AppTheme.bodyText.copyWith(height: 1.6)),
        ],
      ),
    );
  }

  Widget _buildPdfDownload() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: OutlinedButton.icon(
        onPressed: () => _openUrl(_job!.pdfUrl!),
        icon: const Icon(Icons.picture_as_pdf, color: AppTheme.error),
        label: const Text('Download Official Notification PDF'),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: AppTheme.error),
          foregroundColor: AppTheme.error,
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, -2))],
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _openUrl(_job!.applyUrl),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: const Text('Official Site'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton.icon(
              onPressed: () => _openUrl(_job!.applyUrl),
              icon: const Icon(Icons.send, size: 18),
              label: const Text('Apply Now'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingScreen() {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildErrorScreen() {
    return Scaffold(
      appBar: AppBar(title: const Text('Job Details')),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppTheme.textHint),
            SizedBox(height: 16),
            Text('Failed to load job details'),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleSave() async {
    setState(() => _isSaved = !_isSaved);
    try {
      if (_isSaved) {
        await ApiService.post('/saved/${widget.jobId}', {}, auth: true);
      } else {
        await ApiService.delete('/saved/${widget.jobId}', auth: true);
      }
    } catch (_) {
      setState(() => _isSaved = !_isSaved);
    }
  }

  Future<void> _shareJob() async {
    if (_job == null) return;
    Share.share(
      '🔔 Job Alert: ${_job!.title}\n\n'
      '🏢 ${_job!.organization ?? _job!.department ?? ""}\n'
      '📅 Last Date: ${_job!.lastDate != null ? DateFormat("dd MMM yyyy").format(_job!.lastDate!) : "N/A"}\n'
      '📍 ${_job!.state ?? "All India"}\n\n'
      'Apply: ${_job!.applyUrl}\n\n'
      '📱 Download RozgarX App for more jobs!',
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _QuickInfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _QuickInfoCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}
