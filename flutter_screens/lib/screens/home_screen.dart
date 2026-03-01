// ============================================================
// ROZGARX - lib/screens/home_screen.dart
// Main Dashboard with Job Feed
// ============================================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import '../providers/auth_provider.dart';
import '../providers/jobs_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/job_card.dart';
import '../widgets/section_header.dart';
import '../widgets/banner_ad_widget.dart';
import '../widgets/filter_chips_row.dart';
import 'job_detail_screen.dart';
import 'search_screen.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with AutomaticKeepAliveClientMixin {
  final ScrollController _scrollController = ScrollController();
  String _selectedCategory = 'All';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
    _scrollController.addListener(_onScroll);
  }

  void _loadData() {
    final jobsProvider = Provider.of<JobsProvider>(context, listen: false);
    jobsProvider.fetchLatestJobs();
    jobsProvider.fetchTrendingJobs();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 300) {
      Provider.of<JobsProvider>(context, listen: false).loadMoreJobs();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      body: RefreshIndicator(
        onRefresh: () async => _loadData(),
        color: AppTheme.primaryBlue,
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            _buildAppBar(auth),
            SliverToBoxAdapter(child: _buildSearchBar()),
            SliverToBoxAdapter(child: _buildFilterChips()),
            SliverToBoxAdapter(child: _buildTrendingSection()),
            SliverToBoxAdapter(
              child: const BannerAdWidget(), // AdMob banner
            ),
            SliverToBoxAdapter(child: _buildLatestJobsSection()),
            SliverToBoxAdapter(child: _buildLoadMoreIndicator()),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(AuthProvider auth) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: true,
      pinned: true,
      backgroundColor: AppTheme.primaryBlue,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppTheme.primaryBlue, AppTheme.primaryBlueDark],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'नमस्ते, ${auth.user?.name?.split(' ').first ?? 'User'} 👋',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                              fontFamily: 'Poppins',
                            ),
                          ),
                          const Text(
                            'RozgarX',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Poppins',
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          _NotificationBell(),
                          const SizedBox(width: 8),
                          _ProfileAvatar(auth: auth),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const SearchScreen()),
      ),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.search, color: AppTheme.textHint, size: 20),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Search jobs, departments, exams...',
                style: TextStyle(
                  color: AppTheme.textHint,
                  fontSize: 14,
                  fontFamily: 'Poppins',
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.tune, color: AppTheme.primaryBlue, size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    return FilterChipsRow(
      selectedCategory: _selectedCategory,
      onCategoryChanged: (cat) {
        setState(() => _selectedCategory = cat);
        Provider.of<JobsProvider>(context, listen: false)
            .filterByCategory(cat == 'All' ? null : cat.toLowerCase());
      },
    );
  }

  Widget _buildTrendingSection() {
    return Consumer<JobsProvider>(
      builder: (context, jobs, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: '🔥 Trending Jobs', showSeeAll: true),
            SizedBox(
              height: 160,
              child: jobs.isTrendingLoading
                  ? _buildHorizontalShimmer()
                  : ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: jobs.trendingJobs.length,
                      itemBuilder: (ctx, i) => TrendingJobCard(
                        job: jobs.trendingJobs[i],
                        onTap: () => _navigateToDetail(jobs.trendingJobs[i].id),
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLatestJobsSection() {
    return Consumer<JobsProvider>(
      builder: (context, jobs, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: _selectedCategory == 'All'
                  ? '📋 Latest Jobs'
                  : '📋 ${_selectedCategory} Jobs',
              showSeeAll: false,
            ),
            if (jobs.isLoading)
              _buildListShimmer()
            else if (jobs.jobs.isEmpty)
              _buildEmptyState()
            else
              ListView.builder(
                physics: const NeverScrollableScrollPhysics(),
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: jobs.jobs.length,
                itemBuilder: (ctx, i) => JobCard(
                  job: jobs.jobs[i],
                  onTap: () => _navigateToDetail(jobs.jobs[i].id),
                  onSave: () => jobs.toggleSaveJob(jobs.jobs[i].id),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildLoadMoreIndicator() {
    return Consumer<JobsProvider>(
      builder: (_, jobs, __) => jobs.isLoadingMore
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            )
          : const SizedBox(height: 80),
    );
  }

  Widget _buildEmptyState() {
    return const Padding(
      padding: EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(Icons.work_off_outlined, size: 64, color: AppTheme.textHint),
          SizedBox(height: 16),
          Text(
            'No jobs found',
            style: TextStyle(fontSize: 16, color: AppTheme.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildHorizontalShimmer() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: 3,
        itemBuilder: (_, __) => Container(
          width: 200,
          margin: const EdgeInsets.only(right: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  Widget _buildListShimmer() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: 5,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemBuilder: (_, __) => Container(
          height: 130,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  void _navigateToDetail(String jobId) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => JobDetailScreen(jobId: jobId),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}

// ─── INNER WIDGETS ────────────────────────────────────────────
class _NotificationBell extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const NotificationsScreen()),
      ),
      child: Stack(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.notifications_outlined,
                color: Colors.white, size: 22),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppTheme.accentOrange,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  final AuthProvider auth;
  const _ProfileAvatar({required this.auth});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {}, // Navigate to profile
      child: CircleAvatar(
        radius: 18,
        backgroundColor: AppTheme.accentOrange,
        child: Text(
          (auth.user?.name?.isNotEmpty == true
                  ? auth.user!.name![0]
                  : 'U')
              .toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}
