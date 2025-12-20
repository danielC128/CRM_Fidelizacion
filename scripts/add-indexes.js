/**
 * Script para crear índices en la base de datos
 * Ejecutar con: node scripts/add-indexes.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function createIndexes() {
  try {
    console.log('📊 Leyendo script SQL...');

    const sqlFile = path.join(__dirname, '../prisma/add-indexes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Separar por comandos (cada CREATE INDEX)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('SELECT'));

    console.log(`✅ Encontrados ${commands.length} comandos a ejecutar\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      // Extraer nombre del índice para logging
      const indexMatch = command.match(/idx_\w+/);
      const indexName = indexMatch ? indexMatch[0] : `comando ${i + 1}`;

      try {
        console.log(`[${i + 1}/${commands.length}] Creando índice: ${indexName}...`);

        await prisma.$executeRawUnsafe(command);

        console.log(`✅ ${indexName} creado exitosamente\n`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${indexName} ya existe (OK)\n`);
          successCount++;
        } else {
          console.error(`❌ Error creando ${indexName}:`, error.message, '\n');
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Resumen:');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log('='.repeat(50));

    // Verificar índices creados
    console.log('\n🔍 Verificando índices creados...\n');

    const indexes = await prisma.$queryRaw`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;

    console.log('Índices activos:');
    console.table(indexes);

  } catch (error) {
    console.error('💥 Error crítico:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
createIndexes()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
