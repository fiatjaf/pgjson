-- Main query

SELECT doc FROM pgjson.main
WHERE ${where^} = ${condition}
ORDER BY doc->${criteria^} ${order^}, doc->'_id' ${order^}
LIMIT ${limit} OFFSET ${offset}
