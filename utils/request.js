const fs = require("fs/promises");
const path = require("path");
const getArgs = require("./utils");

const querystring = require("querystring");

const parsed = getArgs(process.argv.slice(2));

const { getType, typeMap } = require("./type");

function getTemplateHeader(info) {
  return `
const baseUrl = "${info.baseUrl}";
`
};


function getPayload(method) {
  const arr = ["get", "delete", "head", "options"];
  if (arr.includes(method)) {
    return "{ params }";
  } else {
    // post、put、patch、postForm、putForm、patchForm
    return "params";
  }
}

// 去重处理
const schemasSet = new Set();

function getRefType(key, schemas) {
  let schemasstr = "";
  if (!schemasSet.has(key)) {
    schemasSet.add(key);
    const { str, extraArr } = getType({ ...schemas[key], namespace: key }, true);
    schemasstr += `${str}`;

    // 补齐未声明的类型
    if (extraArr.length) {
      extraArr.forEach((extra) => {
        schemasstr += getRefType(extra, schemas);
      })
    }
  }

  return schemasstr;
}

/**
 * 处理url
 * @param {*} path 
 * @returns 
 */
function parseUrl(path) {
  const query = {};
  const arr = path.split("/");
  const newUrlArr = arr.map(item => {
    if (item.startsWith("{") && item.endsWith("}")) {
      const key = item.slice(1, item.length - 1);
      query[key] = "number | string";
      return `\${params.${key}}`
    }

    return item;
  });

  return {
    url: newUrlArr.join("/"),
    query
  }
}

function parseParams(params, schemas) {
  // 用于处理非.d.ts声明的参数
  let { url, query: queryRef } = parseUrl(params.path);
  let payload;
  let _params;
  let arguments = "";
  const argumentsArr = [];
  const method = params.method;

  let schemasstr = "";

  // 处理参数
  const arr = ["get", "delete", "head", "options"];
  if (arr.includes(method)) {
    payload = "{ params }";

    _params = params.parameters;
    params.parameters?.forEach(item => {
      const key = item.name;
      const schema = item.schema;
      // 处理未声明.d.ts的参数
      if (schema.type) {
        queryRef[key] = typeMap[schema.type];
      } else if (schema.$ref) {
        const ref = schema.$ref.split("/").at(-1);
        schemasstr += getRefType(ref, schemas);
        argumentsArr.push(ref);
      }
    })
  } else {
    // post、put、patch、postForm、putForm、patchForm
    payload = "params";

    if (params.requestBody) {
      const content = params.requestBody.content;
      _params = content;

      const schema = content["application/json"].schema;

      // // todo 不是interface声明的类型
      // if (schema.type) {
      //   const { type, items } = schema;
      //   if (type === "array") {
      //     tstype = formatArrayType(items, extraFlag, extraSet);
      //   } else {
      //     // todo 文件类型
      //     tstype = typeMap[type] ?? type;
      //   }
      // }

      // 写入.d.ts文件
      if (schema.$ref) {
        const key = schema.$ref.split("/").at(-1);
        schemasstr += getRefType(key, schemas);
        argumentsArr.push(key);
      }

    }

    // 针对post请求存在需要拼接query的情况
    if (params.parameters?.length) {
      const query = {};
      params.parameters.forEach(item => {
        const key = item.name;
        const schema = item.schema;
        if (schema.type) {
          query[key] = `\${params.${key}}`;
          queryRef[key] = typeMap[schema.type];
        } else if (schema.$ref) {
          const ref = schema.$ref.split("/").at(-1);
          schemasstr += getRefType(ref, schemas);
          argumentsArr.push(ref);
          const { properties } = schemas[ref];
          Object.keys(properties).forEach((key) => {
            query[key] = `\${params.${key}}`;
          })
        }
      })

      let querystr = querystring.stringify(query, "&", "=", { encodeURIComponent: (data) => data });
      url += `?${querystr}`
    }
  }

  const queryRefKeys = Object.keys(queryRef);
  if (queryRefKeys.length) {
    argumentsArr.push(JSON.stringify(queryRef, null, 2));
  }

  argumentsArr.forEach((arg, index) => {
    if (index !== 0) {
      arguments += ` & ${arg}`
    } else {
      arguments += `${arg}`;
    }
  })


  const hasPayload = !!arguments.length;

  // 处理responses
  const responses = params.responses;
  const content = responses[200].content;
  const contentInfo = Object.values(content);

  contentInfo.forEach(info => {
    const { schema } = info;
    if (schema.$ref) {
      const key = schema.$ref.split("/").at(-1);
      schemasstr += getRefType(key, schemas);
    }
  })

  return {
    url,
    payload: hasPayload ? payload : "",
    _params,
    schemasstr,
    arguments: hasPayload ? `params: ${arguments.replaceAll("\"", "")}` : ""
  }
}

function getApiTemplate(params) {
  const hasPayload = !!params.payload;
  return `
/**
 * ${params.summary || "请补充描述..."}
 * @param {*} ${hasPayload ? "params" : ""}
 * @returns
 */
export const ${params.operationId} = async (${params.arguments}) => {
  const response = await axiosInstance.${params.method}(${params.url}${hasPayload ? `, ${params.payload}` : ""});

  return response;
};
`
}

function getApi(params, options, schemas) {
  // const payload = getPayload(params.method);
  // let url = options.prefix ? `\`\${baseUrl}${params.path}\`` : `"${params.path}"`;

  // if (params.path === "/file/upload/resourcePositionImage") {
  //   console.log(params)
  //   // console.log(params.requestBody)
  // }

  let { url, payload, schemasstr, arguments } = parseParams(params, schemas);
  url = options.prefix ? `\`\${baseUrl}${url}\`` : `"${url}"`;


  //   return `
  // /**
  //  * ${params.summary || "请补充描述..."}
  //  * @param {*} params
  //  * @returns
  //  */
  // export const ${params.operationId} = async (params) => {
  //   const response = await axiosInstance.${params.method}(${url}, ${payload});

  //   return response;
  // };
  // `

  return {
    template: getApiTemplate({ ...params, url, payload, arguments }),
    type: schemasstr
  }
};

async function getRequestFile(json, options) {
  let str = "";
  const baseUrl = json.servers[0].url;
  str += getTemplateHeader({ baseUrl });

  const paths = Object.keys(json.paths);

  const schemas = json.components.schemas;


  let typeStr = "";

  paths.forEach((path) => {
    const info = json.paths[path];
    const method = Object.keys(info)[0];

    const { template, type } = getApi({ path, method, ...info[method] }, options, schemas);

    str += `${template} \n`;
    if (type) {
      typeStr += `${type}`
    }
  });

  const fileName = `api.${options.suffix}`;
  let outPath = path.resolve(__dirname, fileName);
  const _path = parsed.o;
  if (_path && typeof _path !== "boolean") {
    outPath = path.resolve(_path, fileName);
  }

  await fs.writeFile(outPath, str);
  await fs.writeFile(path.resolve(__dirname, "type.d.ts"), typeStr);

  return paths;
};

module.exports = {
  getRequestFile
}