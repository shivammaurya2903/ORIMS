-- Create user with native password authentication
CREATE USER IF NOT EXISTS 'orims_user'@'%' IDENTIFIED WITH mysql_native_password BY 'orims_dev_password';
GRANT ALL PRIVILEGES ON orims.* TO 'orims_user'@'%';
FLUSH PRIVILEGES;

-- Also update root if needed
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'orims_root_password';
FLUSH PRIVILEGES;