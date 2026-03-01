// ============================================================
// ROZGARX - lib/screens/main_navigation.dart
// Bottom Navigation with 5 Tabs
// ============================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';
import 'search_screen.dart';
import 'saved_jobs_screen.dart';
import 'study_screen.dart';
import 'profile_screen.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});
  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _selectedIndex = 0;

  final _screens = [
    const HomeScreen(),
    const SearchScreen(),
    const SavedJobsScreen(),
    const StudyScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        backgroundColor: Colors.white,
        indicatorColor: AppTheme.primaryBlue.withOpacity(0.12),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppTheme.primaryBlue),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.search),
            selectedIcon: Icon(Icons.search, color: AppTheme.primaryBlue),
            label: 'Search',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_outline),
            selectedIcon: Icon(Icons.bookmark, color: AppTheme.primaryBlue),
            label: 'Saved',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book, color: AppTheme.primaryBlue),
            label: 'Study',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppTheme.primaryBlue),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// ============================================================
// ROZGARX - lib/providers/jobs_provider.dart
// ============================================================
import 'package:flutter/material.dart';
import '../models/job_model.dart';
import '../services/api_service.dart';

class JobsProvider extends ChangeNotifier {
  List<JobModel> _jobs = [];
  List<JobModel> _trendingJobs = [];
  List<String> _savedJobIds = [];
  bool _isLoading = false;
  bool _isTrendingLoading = false;
  bool _isLoadingMore = false;
  int _currentPage = 1;
  int _totalPages = 1;
  String? _currentCategory;

  List<JobModel> get jobs => _jobs;
  List<JobModel> get trendingJobs => _trendingJobs;
  bool get isLoading => _isLoading;
  bool get isTrendingLoading => _isTrendingLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool isJobSaved(String id) => _savedJobIds.contains(id);

  Future<void> fetchLatestJobs({String? category}) async {
    _isLoading = true;
    _currentPage = 1;
    notifyListeners();
    try {
      final params = category != null ? '?category=$category' : '';
      final data = await ApiService.get('/jobs$params');
      _jobs = (data['jobs'] as List).map((j) => JobModel.fromJson(j)).toList();
      _totalPages = data['totalPages'] ?? 1;
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> fetchTrendingJobs() async {
    _isTrendingLoading = true;
    notifyListeners();
    try {
      final data = await ApiService.get('/jobs/trending');
      _trendingJobs = (data as List).map((j) => JobModel.fromJson(j)).toList();
    } catch (_) {}
    _isTrendingLoading = false;
    notifyListeners();
  }

  Future<void> loadMoreJobs() async {
    if (_isLoadingMore || _currentPage >= _totalPages) return;
    _isLoadingMore = true;
    notifyListeners();
    try {
      _currentPage++;
      final params = '?page=$_currentPage${_currentCategory != null ? '&category=$_currentCategory' : ''}';
      final data = await ApiService.get('/jobs$params');
      final newJobs = (data['jobs'] as List).map((j) => JobModel.fromJson(j)).toList();
      _jobs.addAll(newJobs);
    } catch (_) {}
    _isLoadingMore = false;
    notifyListeners();
  }

  Future<void> searchJobs(String query) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService.get('/jobs/search?q=${Uri.encodeComponent(query)}');
      _jobs = (data as List).map((j) => JobModel.fromJson(j)).toList();
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  void filterByCategory(String? category) {
    _currentCategory = category;
    fetchLatestJobs(category: category);
  }

  Future<void> fetchSavedJobs() async {
    try {
      final data = await ApiService.get('/saved', auth: true);
      _savedJobIds = (data as List).map((j) => j['id'].toString()).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> toggleSaveJob(String jobId) async {
    if (_savedJobIds.contains(jobId)) {
      _savedJobIds.remove(jobId);
      ApiService.delete('/saved/$jobId', auth: true);
    } else {
      _savedJobIds.add(jobId);
      ApiService.post('/saved/$jobId', {}, auth: true);
    }
    notifyListeners();
  }
}

// ============================================================
// ROZGARX - lib/providers/theme_provider.dart
// ============================================================
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.system;
  ThemeMode get themeMode => _themeMode;

  ThemeProvider() {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final mode = prefs.getString('theme_mode') ?? 'system';
    _themeMode = mode == 'dark' ? ThemeMode.dark : mode == 'light' ? ThemeMode.light : ThemeMode.system;
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _themeMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme_mode', _themeMode == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }
}
