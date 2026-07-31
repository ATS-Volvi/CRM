const { Sequelize } = require('sequelize');

const sq = new Sequelize({
  dialect: 'sqlite',
  storage: 'C:/Users/swast/OneDrive/Desktop/CRM/CRM/nexus_crm.sqlite',
  logging: false
});

async function run() {
  try {
    // 1. Get current stages
    const [stages] = await sq.query('SELECT id, name, [order] FROM PipelineStages ORDER BY [order]');
    console.log('Current stages:', stages.map(s => `${s.name} (${s.id})`).join(', '));

    // Build a map of old name -> id
    const stageMap = {};
    for (const s of stages) stageMap[s.name] = s.id;

    // 2. Desired final stages
    const newStages = [
      { name: 'Qualification', order: 1, probability: 20, groupType: 'open' },
      { name: 'Needs Analysis', order: 2, probability: 40, groupType: 'open' },
      { name: 'Proposal', order: 3, probability: 60, groupType: 'open' },
      { name: 'Negotiation', order: 4, probability: 80, groupType: 'open' },
      { name: 'Closed Won', order: 5, probability: 100, groupType: 'closed' },
      { name: 'Closed Lost', order: 6, probability: 0, groupType: 'closed' },
    ];

    // 3. Rename existing stages where possible, insert new ones
    // Map: old -> new
    const renameMap = {
      'New': 'Qualification',
      'Contacted': 'Needs Analysis',
      'Proposal': 'Proposal',       // keep
      'Negotiation': 'Negotiation', // keep
      'Won': 'Closed Won',
      'Lost': 'Closed Lost',
    };

    // Stages to delete (deals will be moved first)
    const toDelete = ['Qualified', 'Meeting/Demo', 'On Hold'];

    // Move deals from 'Qualified' -> 'Qualification' stage id
    // Move deals from 'Meeting/Demo' -> 'Needs Analysis' stage id
    // Move deals from 'On Hold' -> 'Closed Lost' stage id

    // First do the renames so we know the new IDs
    for (const [oldName, newName] of Object.entries(renameMap)) {
      if (stageMap[oldName]) {
        const newStageData = newStages.find(s => s.name === newName);
        await sq.query(
          `UPDATE PipelineStages SET name = ?, [order] = ?, probability = ? WHERE id = ?`,
          { replacements: [newName, newStageData.order, newStageData.probability, stageMap[oldName]] }
        );
        console.log(`Renamed: ${oldName} -> ${newName}`);
        // Update map so we can reference by new name
        stageMap[newName] = stageMap[oldName];
      }
    }

    // Refresh stage map
    const [updatedStages] = await sq.query('SELECT id, name FROM PipelineStages');
    const updatedMap = {};
    for (const s of updatedStages) updatedMap[s.name] = s.id;

    // Move deals from stages being deleted
    const moveMap = {
      'Qualified': 'Qualification',
      'Meeting/Demo': 'Needs Analysis',
      'On Hold': 'Closed Lost',
    };
    for (const [fromName, toName] of Object.entries(moveMap)) {
      if (stageMap[fromName] && updatedMap[toName]) {
        const [result] = await sq.query(
          `UPDATE Deals SET stageId = ? WHERE stageId = ?`,
          { replacements: [updatedMap[toName], stageMap[fromName]] }
        );
        console.log(`Moved deals from ${fromName} -> ${toName}`);
      }
    }

    // Delete the now-empty old stages
    for (const name of toDelete) {
      if (stageMap[name]) {
        await sq.query(`DELETE FROM PipelineStages WHERE id = ?`, { replacements: [stageMap[name]] });
        console.log(`Deleted stage: ${name}`);
      }
    }

    // 4. Verify final state
    const [finalStages] = await sq.query('SELECT name, [order], probability FROM PipelineStages ORDER BY [order]');
    console.log('\nFinal pipeline stages:');
    finalStages.forEach(s => console.log(`  ${s.order}. ${s.name} (${s.probability}%)`));

    await sq.close();
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
    await sq.close();
    process.exit(1);
  }
}

run();
