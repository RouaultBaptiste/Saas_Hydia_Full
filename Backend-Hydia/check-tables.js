require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Création du client Supabase avec la clé service_role pour contourner RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variables d\'environnement SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  try {
    console.log('Vérification des tables dans la base de données Supabase...');
    
    // Vérifier la table profiles
    console.log('\n--- Table profiles ---');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('Erreur lors de la vérification de la table profiles:', profilesError);
    } else {
      console.log('✅ Table profiles existe');
      console.log('Structure:', Object.keys(profilesData[0] || {}));
    }
    
    // Vérifier la table formations
    console.log('\n--- Table formations ---');
    const { data: formationsData, error: formationsError } = await supabase
      .from('formations')
      .select('*')
      .limit(1);
    
    if (formationsError) {
      console.error('Erreur lors de la vérification de la table formations:', formationsError);
    } else {
      console.log('✅ Table formations existe');
      console.log('Structure:', Object.keys(formationsData[0] || {}));
    }
    
    // Vérifier la structure de la table formations
    console.log('\n--- Structure détaillée de la table formations ---');
    const { data: formationsSchema, error: schemaError } = await supabase
      .rpc('get_table_definition', { table_name: 'formations' });
    
    if (schemaError) {
      console.error('Erreur lors de la récupération du schéma de la table formations:', schemaError);
    } else {
      console.log(formationsSchema);
    }
    
    // Vérifier les relations entre tables
    console.log('\n--- Vérification des relations entre tables ---');
    const { data: foreignKeys, error: fkError } = await supabase
      .rpc('get_foreign_keys', { schema_name: 'public' });
    
    if (fkError) {
      console.error('Erreur lors de la récupération des clés étrangères:', fkError);
    } else {
      console.log('Relations trouvées:');
      console.log(foreignKeys);
    }
    
  } catch (error) {
    console.error('Erreur lors de la vérification des tables:', error);
  }
}

checkTables();

// Fonction pour créer la fonction get_table_definition si elle n'existe pas
async function createHelperFunctions() {
  try {
    // Créer la fonction get_table_definition
    const { error: createFnError } = await supabase.rpc('create_get_table_definition_function');
    
    if (createFnError) {
      console.error('Erreur lors de la création de la fonction get_table_definition:', createFnError);
    } else {
      console.log('Fonction get_table_definition créée avec succès');
    }
    
    // Créer la fonction get_foreign_keys
    const { error: createFkFnError } = await supabase.rpc('create_get_foreign_keys_function');
    
    if (createFkFnError) {
      console.error('Erreur lors de la création de la fonction get_foreign_keys:', createFkFnError);
    } else {
      console.log('Fonction get_foreign_keys créée avec succès');
    }
  } catch (error) {
    console.error('Erreur lors de la création des fonctions helper:', error);
  }
}
