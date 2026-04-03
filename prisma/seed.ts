import { seedDatabase } from '../src/lib/seed'

seedDatabase()
  .then((result) => {
    console.log('\n✅ Seed result:', JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
