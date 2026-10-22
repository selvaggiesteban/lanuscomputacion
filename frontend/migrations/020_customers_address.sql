-- Dirección del perfil de cliente (el formulario /perfil ya la enviaba pero la columna no existía)
ALTER TABLE customers ADD COLUMN address TEXT;
