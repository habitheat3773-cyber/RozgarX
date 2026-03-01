// ============================================================
// ROZGARX - lib/providers/auth_provider.dart
// Authentication State Management
// ============================================================

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  bool _isInitialized = false;
  String? _error;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _user != null;
  bool get isPremium => _user?.subscriptionStatus == 'premium';
  String? get error => _error;
  bool get isInitialized => _isInitialized;

  // ─── INIT: Check saved session ────────────────────────────
  Future<void> initAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    final userJson = prefs.getString('user_data');

    if (token != null && userJson != null) {
      try {
        _user = UserModel.fromJson(jsonDecode(userJson));
        // Silently refresh profile in background
        _refreshProfile();
      } catch (_) {
        await _clearSession();
      }
    }
    _isInitialized = true;
    notifyListeners();
  }

  Future<void> _refreshProfile() async {
    try {
      final data = await ApiService.get('/profile', auth: true);
      _user = UserModel.fromJson(data);
      await _saveUserLocally();
      notifyListeners();
    } catch (_) {}
  }

  // ─── EMAIL REGISTER ───────────────────────────────────────
  Future<bool> register({
    required String name,
    required String email,
    required String password,
    String? qualification,
    String? state,
  }) async {
    _setLoading(true);
    try {
      final data = await ApiService.post('/auth/register', {
        'name': name,
        'email': email,
        'password': password,
        'qualification': qualification,
        'state': state,
      });
      await _handleAuthSuccess(data);
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ─── EMAIL LOGIN ──────────────────────────────────────────
  Future<bool> login(String email, String password) async {
    _setLoading(true);
    try {
      final data = await ApiService.post('/auth/login', {
        'email': email,
        'password': password,
      });
      await _handleAuthSuccess(data);
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ─── SEND OTP ─────────────────────────────────────────────
  Future<bool> sendOtp(String phone) async {
    _setLoading(true);
    try {
      await ApiService.post('/auth/send-otp', {'phone': phone});
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ─── VERIFY OTP ───────────────────────────────────────────
  Future<bool> verifyOtp(String phone, String otp, {String? name}) async {
    _setLoading(true);
    try {
      final data = await ApiService.post('/auth/verify-otp', {
        'phone': phone,
        'otp': otp,
        if (name != null) 'name': name,
      });
      await _handleAuthSuccess(data);
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ─── GOOGLE LOGIN ─────────────────────────────────────────
  Future<bool> loginWithGoogle(String idToken) async {
    _setLoading(true);
    try {
      final data = await ApiService.post('/auth/google', {'idToken': idToken});
      await _handleAuthSuccess(data);
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  // ─── UPDATE PROFILE ───────────────────────────────────────
  Future<bool> updateProfile(Map<String, dynamic> updates) async {
    try {
      final data = await ApiService.put('/profile', updates, auth: true);
      _user = UserModel.fromJson(data);
      await _saveUserLocally();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  // ─── LOGOUT ──────────────────────────────────────────────
  Future<void> logout() async {
    await _clearSession();
    _user = null;
    notifyListeners();
  }

  // ─── HELPERS ─────────────────────────────────────────────
  Future<void> _handleAuthSuccess(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', data['accessToken']);
    if (data['refreshToken'] != null) {
      await prefs.setString('refresh_token', data['refreshToken']);
    }
    _user = UserModel.fromJson(data['user']);
    await _saveUserLocally();
    _error = null;
    notifyListeners();
  }

  Future<void> _saveUserLocally() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_data', jsonEncode(_user?.toJson()));
  }

  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_data');
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
