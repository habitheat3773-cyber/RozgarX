// ============================================================
// ROZGARX - lib/models/user_model.dart
// ============================================================

class UserModel {
  final String id;
  final String? name;
  final String? email;
  final String? phone;
  final String? qualification;
  final String? state;
  final String? category;
  final String? jobPreference;
  final String subscriptionStatus;
  final DateTime? subscriptionEnd;

  UserModel({
    required this.id,
    this.name,
    this.email,
    this.phone,
    this.qualification,
    this.state,
    this.category,
    this.jobPreference,
    this.subscriptionStatus = 'free',
    this.subscriptionEnd,
  });

  bool get isPremium => subscriptionStatus == 'premium';

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] ?? '',
        name: json['name'],
        email: json['email'],
        phone: json['phone'],
        qualification: json['qualification'],
        state: json['state'],
        category: json['category'],
        jobPreference: json['job_preference'],
        subscriptionStatus: json['subscription_status'] ?? 'free',
        subscriptionEnd: json['subscription_end'] != null
            ? DateTime.tryParse(json['subscription_end'])
            : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'qualification': qualification,
        'state': state,
        'category': category,
        'job_preference': jobPreference,
        'subscription_status': subscriptionStatus,
        'subscription_end': subscriptionEnd?.toIso8601String(),
      };
}

// ============================================================
// ROZGARX - lib/models/job_model.dart
// ============================================================

class JobModel {
  final String id;
  final String title;
  final String? department;
  final String? organization;
  final String category;
  final String? state;
  final int? vacancies;
  final int? salaryMin;
  final int? salaryMax;
  final String? salaryText;
  final String? qualification;
  final int? ageMin;
  final int? ageMax;
  final String? applicationFee;
  final DateTime? lastDate;
  final String? shortDescription;
  final String? fullDescription;
  final String? selectionProcess;
  final String? examPattern;
  final String? syllabusUrl;
  final String? pdfUrl;
  final String applyUrl;
  final bool isFeatured;
  final int viewCount;
  final DateTime createdAt;

  JobModel({
    required this.id,
    required this.title,
    this.department,
    this.organization,
    this.category = 'government',
    this.state,
    this.vacancies,
    this.salaryMin,
    this.salaryMax,
    this.salaryText,
    this.qualification,
    this.ageMin,
    this.ageMax,
    this.applicationFee,
    this.lastDate,
    this.shortDescription,
    this.fullDescription,
    this.selectionProcess,
    this.examPattern,
    this.syllabusUrl,
    this.pdfUrl,
    this.applyUrl = '#',
    this.isFeatured = false,
    this.viewCount = 0,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  bool get isDeadlineNear {
    if (lastDate == null) return false;
    return lastDate!.difference(DateTime.now()).inDays <= 3;
  }

  bool get isExpired {
    if (lastDate == null) return false;
    return lastDate!.isBefore(DateTime.now().subtract(const Duration(days: 1)));
  }

  String get displaySalary {
    if (salaryText != null && salaryText!.isNotEmpty) return salaryText!;
    if (salaryMin != null && salaryMax != null) {
      return '₹${_formatNum(salaryMin!)} - ₹${_formatNum(salaryMax!)}';
    }
    if (salaryMin != null) return '₹${_formatNum(salaryMin!)}+';
    return 'As per norms';
  }

  String _formatNum(int n) {
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  factory JobModel.fromJson(Map<String, dynamic> json) => JobModel(
        id: json['id'] ?? '',
        title: json['title'] ?? '',
        department: json['department'],
        organization: json['organization'],
        category: json['category'] ?? 'government',
        state: json['state'],
        vacancies: json['vacancies'],
        salaryMin: json['salary_min'],
        salaryMax: json['salary_max'],
        salaryText: json['salary_text'],
        qualification: json['qualification'],
        ageMin: json['age_min'],
        ageMax: json['age_max'],
        applicationFee: json['application_fee'],
        lastDate: json['last_date'] != null ? DateTime.tryParse(json['last_date']) : null,
        shortDescription: json['short_description'],
        fullDescription: json['full_description'],
        selectionProcess: json['selection_process'],
        examPattern: json['exam_pattern'],
        syllabusUrl: json['syllabus_url'],
        pdfUrl: json['pdf_url'],
        applyUrl: json['apply_url'] ?? '#',
        isFeatured: json['is_featured'] ?? false,
        viewCount: json['view_count'] ?? 0,
        createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) ?? DateTime.now() : DateTime.now(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'department': department,
        'category': category,
        'salary_text': salaryText,
        'last_date': lastDate?.toIso8601String(),
        'apply_url': applyUrl,
      };
}
