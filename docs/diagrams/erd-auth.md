# Auth / RBAC / Users ERD (detailed)

```mermaid
erDiagram
    COMPANY ||--o{ USER : employs
    COMPANY ||--o{ ROLE : defines

    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : grants
    ROLE ||--o{ ROLE_PERMISSION : includes
    PERMISSION ||--o{ ROLE_PERMISSION : in

    USER ||--o{ APPROVAL_LIMIT : has
    USER ||--o{ USER_SESSION : opens
    USER ||--o{ USER_DEVICE : uses
    USER ||--o{ LOGIN_ATTEMPT : generates
    USER ||--o{ PASSWORD_HISTORY : rotates
    USER ||--o{ AUDIT_LOG : actor_of
    USER ||--o{ DIGITAL_SIGNATURE : signs

    OFFICE ||--o{ USER_ROLE : scopes

    USER {
        uuid id PK
        uuid company_id FK
        uuid employee_id FK "nullable"
        string email "unique per company"
        string phone
        enum status "INVITED|ACTIVE|DISABLED"
        string locale "en|fr"
        char currency
        string password_hash "argon2id"
        bool mfa_enabled
        bytes mfa_secret_enc
        timestamptz last_login_at
        int version
        timestamptz deleted_at
    }

    ROLE {
        uuid id PK
        uuid company_id FK
        string key
        string name
        bool is_system
        int hierarchy_level
    }

    PERMISSION {
        uuid id PK
        string key "resource:action"
        string resource
        string action
        string description
    }

    USER_ROLE {
        uuid user_id FK
        uuid role_id FK
        uuid office_id FK "nullable"
    }

    APPROVAL_LIMIT {
        uuid id PK
        uuid user_id FK
        string resource
        char currency
        numeric max_amount
    }

    USER_SESSION {
        uuid id PK
        uuid user_id FK
        uuid device_id FK
        string ip
        string user_agent
        timestamptz created_at
        timestamptz expires_at
        timestamptz revoked_at
    }

    LOGIN_ATTEMPT {
        uuid id PK
        uuid user_id FK "nullable"
        string email
        string ip
        bool success
        string reason
        timestamptz created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid company_id FK
        uuid actor_id FK
        string action
        string entity_type
        uuid entity_id
        jsonb before
        jsonb after
        string ip
        string user_agent
        timestamptz created_at
    }
```

**Notes**
- `AUDIT_LOG` and `DIGITAL_SIGNATURE` are **append-only** (enforced by trigger + revoked UPDATE/DELETE for the app role).
- `USER_ROLE.office_id` allows a role to be scoped to a specific office (e.g., "Finance Officer, Douala").
- `APPROVAL_LIMIT` is consulted by the workflow engine to route approvals upward when an amount exceeds an approver's limit.
