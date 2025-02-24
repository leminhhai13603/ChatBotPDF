exports.cosineSimilarityQuery = (tableName, vectorColumn, queryVector, returnColumn, limit) => {
    return {
        text: `
            SELECT ${returnColumn}, 1 - (embedding <=> $1) AS similarity
            FROM ${tableName}
            ORDER BY similarity DESC
            LIMIT ${limit};
        `,
        values: [queryVector]
    };
};
