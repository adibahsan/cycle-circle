# Charging & Subscriber Management Flow

```mermaid
flowchart TD
    A([User Enters Platform]) --> B{OTP Verified?}

    B -- Yes --> C[Auto-charge 2 BDT\nvia Subscription API]
    B -- No --> D[Store Mobile Number\nin Database]

    C --> E[Store Mobile Number\nin Database]

    D --> F[Send CAAS Charging\nRequest to All Stored Users]
    E --> F

    F --> G{Charge\nSuccessful?}

    G -- Yes --> H([User is Active Subscriber])

    G -- No --> I{Already\nCharged?}

    I -- Yes --> H

    I -- No --> J[Trigger Manual\nCAAS Charging Request]

    J --> K{Manual Charge\nSuccessful?}

    K -- Yes --> H
    K -- No --> L([Mark for Retry /\nEscalate])

    classDef entry    fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    classDef process  fill:#dcfce7,stroke:#22c55e,color:#14532d
    classDef decision fill:#fef9c3,stroke:#eab308,color:#713f12
    classDef success  fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef danger   fill:#fee2e2,stroke:#ef4444,color:#7f1d1d

    class A entry
    class C,D,E,F,J process
    class B,G,I,K decision
    class H success
    class L danger
```
