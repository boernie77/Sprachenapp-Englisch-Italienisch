const { User, Vocabulary, Stats } = require('./models');

async function debugStats() {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email'],
            include: [{
                model: Vocabulary,
                attributes: ['id', 'language'],
                include: [{
                    model: Stats,
                    attributes: ['presented', 'correct']
                }]
            }]
        });

        console.log(`Found ${users.length} users.`);
        
        users.forEach(user => {
            const u = user.toJSON();
            console.log(`User: ${u.email} (ID: ${u.id})`);
            
            // Check keys in user object
            console.log(` - User keys: ${Object.keys(u).join(', ')}`);
            
            const vocabs = u.Vocabularies || u.Vocabuary || [];
            console.log(` - Vocab count: ${vocabs.length}`);
            
            if (vocabs.length > 0) {
                const first = vocabs[0];
                console.log(` - Keys in first vocab: ${Object.keys(first).join(', ')}`);
                const stat = first.Stat || first.Statistic || first.Stats || first.Statistics;
                console.log(` - Stat object found: ${!!stat}`);
                if (stat) {
                    console.log(` - Stat details: ${JSON.stringify(stat)}`);
                }
            }
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugStats();
