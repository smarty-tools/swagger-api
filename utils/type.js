const fs = require("fs/promises");
const path = require("path");

const getTypeFile = async (schemas) => {
  // const keys = Object.keys(schemas);
  let schemasstr = getTypes(schemas)

  await fs.writeFile(path.resolve(__dirname, "api.d.ts"), schemasstr);
}

// const getType = (keys) => {
//   let schemasstr = "";
//   const schemasSet = new Set();
//   keys.forEach((key) => {
//     const { type, properties } = schemas[key];
//     if (type === "object") {
//       const schemasSetKeys = schemasSet.keys();
//       let str;
//       if (schemasSet.size) {
//         for (const schemasSetKey of schemasSetKeys) {
//           if (key.startsWith(schemasSetKey)) {
//             str = `interface ${key} extends ${schemasSetKey} {`;
//             break;
//           } else {
//             str = `interface ${key} {`;
//           }
//         }
//       } else {
//         str = `interface ${key} {`;
//       }



//       const propertiesArr = Object.keys(properties);

//       propertiesArr.forEach((key) => {
//         const { type, $ref, items } = properties[key];

//         let tstype;

//         if (!type) {
//           if ($ref) {
//             const ref = $ref.split("/").at(-1);
//             tstype = ref;
//           } else {
//             tstype = "unknow";
//           }
//         } else {
//           if (type === "array") {
//             if (items.type) {
//               tstype = `${items.type}[]`;
//             } else if (items.$ref) {
//               const ref = items.$ref.split("/").at(-1);
//               tstype = `${ref}[]`;
//             }
//           } else {
//             tstype = typeMap[type] ?? type;
//           }
//         }
//         str += `
//     ${key}: ${tstype};`
//       })

//       str += `
//   }`

//       schemasstr += `${str} ${schemasSet.size}\n`;


//       schemasSet.add(key);
//     }

//   })

//   return schemasstr;
// }

const typeMap = {
  "string": "string",
  "integer": "number",
  "number": "number",
  "boolean": "boolean",
}

const getTypes = (schemas) => {
  let schemasstr = "";
  const keys = Object.keys(schemas);
  keys.forEach((key) => {
    const { str } = getType({ ...schemas[key], namespace: key });
    schemasstr += `${str}\n`;
  })

  return schemasstr;
}

function formatArrayType(data, flag, set) {
  let type = "";
  if (data.type) {
    // tstype = `${items.type}[]`;
    type = `${typeMap[data.type] ?? data.type}[]`
  } else if (items.$ref) {
    const ref = getRef(data.$ref);
    type = `${ref}[]`;

    if (flag) {
      set.add(ref);
    }
  }

  return type;
}

function getRef(source) {
  const ref = source.split("/").at(-1);
  return ref;
}

const getType = (info, extraFlag = false) => {
  const { type, properties, namespace } = info;
  let str;
  const extraSet = new Set();
  if (type === "object") {
    str = `interface ${namespace} {`;
    const propertiesArr = Object.keys(properties);

    propertiesArr.forEach((key) => {
      const { type, $ref, items } = properties[key];

      let tstype;

      if (!type) {
        if ($ref) {
          const ref = getRef($ref);
          tstype = ref;
        } else {
          tstype = "unknow";
        }
      } else {
        if (type === "array") {
          tstype = formatArrayType(items, extraFlag, extraSet);
        } else {
          tstype = typeMap[type] ?? type;
        }
      }
      str += `
  ${key}: ${tstype};`
    })

    str += `
} \n\r`
  } else {
    str = "";
  }

  return {
    str,
    extraArr: [...extraSet]
  };
}

exports = {
  getTypeFile,
  getType
}

module.exports = exports;