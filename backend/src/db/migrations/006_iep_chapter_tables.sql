-- Six IEP chapter tables. The application migration also moves ieps.content
-- fields and records version 006 atomically; start the backend to perform it.
-- This DDL reference alone does not move or remove any existing data.

CREATE TABLE IF NOT EXISTS iep_assessments (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    student_family_form JSON NULL,
    assessment_selections JSON NULL,
    assessment_details JSON NULL,
    strength_weakness_summary JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_assessments_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='壹：學生能力現況、家庭狀況及需求評估';

CREATE TABLE IF NOT EXISTS iep_services (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    special_education_support JSON NULL,
    inclusive_education_plan JSON NULL,
    curriculum_adjustment JSON NULL,
    course_plan_items JSON NULL,
    weekly_schedule JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_services_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='貳：特殊教育、相關服務及支持策略';

CREATE TABLE IF NOT EXISTS iep_goals (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    goal_domains JSON NULL,
    semester_goals JSON NULL,
    learning_notes JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_goals_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='參：學年與學期教育目標';

CREATE TABLE IF NOT EXISTS iep_behavior_interventions (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    behavior_intervention JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_behavior_interventions_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='肆：行為功能介入方案及行政支援';

CREATE TABLE IF NOT EXISTS iep_transitions (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    transition_support JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_transitions_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='伍：學生轉銜輔導及服務內容';

CREATE TABLE IF NOT EXISTS iep_meetings (
    iep_id CHAR(36) NOT NULL PRIMARY KEY,
    meeting_records JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_iep_meetings_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='IEP 會議紀錄';
