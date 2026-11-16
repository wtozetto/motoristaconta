-- Função para contagem total de usuários
CREATE OR REPLACE FUNCTION get_total_users()
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM profiles);
END;
$$ LANGUAGE plpgsql STABLE;
