CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    noise_sensitivity INTEGER CHECK (noise_sensitivity BETWEEN 1 AND 5),
    crowd_sensitivity INTEGER CHECK (crowd_sensitivity BETWEEN 1 AND 5),
    light_sensitivity INTEGER CHECK (light_sensitivity BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);