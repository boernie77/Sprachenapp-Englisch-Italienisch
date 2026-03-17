require('dotenv').config();
const { sequelize, Vocabulary } = require('./models');

async function testDB() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        
        const item = await Vocabulary.findOne();
        if (item) {
            console.log('Sample item keys:', Object.keys(item.dataValues));
            console.log('Has isOwn?', 'isOwn' in item.dataValues);
            console.log('isOwn value:', item.dataValues.isOwn);
        } else {
            console.log('No Vocabulary items found.');
        }

        const [results] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Vocabularies';");
        console.log('\nTable columns for Vocabularies:');
        console.log(results);

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

testDB();
