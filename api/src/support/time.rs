use chrono::{DateTime, Utc};

pub fn to_rfc3339(value: DateTime<Utc>) -> String {
    value.to_rfc3339()
}
