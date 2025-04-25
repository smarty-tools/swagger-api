const fs = require("fs/promises");
const path = require("path");
const getArgs = require("./utils");

const querystring = require("querystring");

const parsed = getArgs(process.argv.slice(2));

const { getType, typeMap } = require("./type");
const { getTemplateHeader, getApiTemplate } = require("./template");

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

function parseParams(params, schemas, options) {
  // 用于处理非.d.ts声明的参数
  const { url, query: queryRef } = parseUrl(params.path);
  const result = {
    url
  };
  let payload;
  let _params;
  // 用于存储形参
  const argumentsArr = [];
  const method = params.method;

  let schemasstr = "";

  const isTS = options.suffix === "ts";

  // 处理参数
  const arr = ["get", "delete", "head", "options"];
  if (arr.includes(method)) {
    payload = "{ params }";

    _params = params.parameters;
    const parameters = params.parameters || [];
    if (isTS) {
      parameters.forEach(item => {
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
      if (parameters.length) {
        argumentsArr.push("parameters");
      }
    }

  } else {
    // post、put、patch、postForm、putForm、patchForm
    payload = "params";

    if (params.requestBody) {
      const content = params.requestBody.content;
      _params = content;

      const schema = content["application/json"].schema;

      // // todo 不是interface声明的类型
      if (schema.type) {
        const { type, items, properties } = schema;
        // if (type === "array") {
        //   tstype = formatArrayType(items, extraFlag, extraSet);
        // } else {
        //   // todo 文件类型
        //   tstype = typeMap[type] ?? type;
        // }

        if (properties) {
          if (isTS) {
            Object.entries(properties).forEach(([key, value]) => {
              // queryRef[key] = ;
              const { type, format } = value;
              if (format === "binary") {
                queryRef[key] = "File";
              } else {
                queryRef[key] = typeMap[type] ?? type;
              }
            })
          } else {
            argumentsArr.push("requestBody");
          }
        }


      }

      // 写入.d.ts文件
      if (schema.$ref) {
        if (isTS) {
          const key = schema.$ref.split("/").at(-1);
          schemasstr += getRefType(key, schemas);
          argumentsArr.push(key);
        } else {
          argumentsArr.push("requestBody");
        }
      }
    }

    // 针对post请求存在需要拼接query的情况
    if (params.parameters?.length) {
      const query = {};
      params.parameters.forEach(item => {
        const key = item.name;
        const schema = item.schema;
        if (schema.type) {
          if (item.in !== "path") {
            query[key] = `\${params.${key}}`;
          }
          if (isTS) {
            queryRef[key] = typeMap[schema.type];
          } else {
            argumentsArr.push("parameters");
          }
        } else if (schema.$ref) {
          const ref = schema.$ref.split("/").at(-1);
          const { properties } = schemas[ref];
          Object.keys(properties).forEach((key) => {
            query[key] = `\${params.${key}}`;
          })

          if (isTS) {
            schemasstr += getRefType(ref, schemas);
            argumentsArr.push(ref);
          } else {
            argumentsArr.push("parameters");
          }
        }
      })

      let querystr = querystring.stringify(query, "&", "=", { encodeURIComponent: (data) => data });
      // url += `?${querystr}`
      if (querystr.length) {
        result.url = url + `?${querystr}`;
      }
    }
  }

  // 将url中的参数 或 非.d.ts声明的参数存入argumentsArr
  const queryRefKeys = Object.keys(queryRef);
  if (queryRefKeys.length) {
    argumentsArr.push(JSON.stringify(queryRef, null, 2));
  }

  const hasPayload = !!argumentsArr.length;


  if (isTS) {
    // 将参数声明整合为字符串
    let arguments = "";
    argumentsArr.forEach((arg, index) => {
      if (index !== 0) {
        arguments += ` & ${arg}`
      } else {
        arguments += `${arg}`;
      }
    })

    result.arguments = hasPayload ? `params: ${arguments.replaceAll("\"", "")}` : "";

    // 处理responses
    const responses = params.responses;
    const content = responses[200].content;
    const contentInfo = Object.values(content);

    const responseArr = [];
    contentInfo.forEach(info => {
      const { schema } = info;
      if (schema.$ref) {
        const key = schema.$ref.split("/").at(-1);
        responseArr.push(key);
        schemasstr += getRefType(key, schemas);
      }
    })

    result.response = responseArr.join("&");

    result.schemasstr = schemasstr;
  } else {
    result.arguments = hasPayload ? "params" : "";
  }

  result.payload = hasPayload ? payload : "";

  return result;
}

function getApi(params, options, schemas) {
  let { url, payload, schemasstr, arguments, response } = parseParams(params, schemas, options);
  url = options.prefix ? `\`\${baseUrl}${url}\`` : `"${url}"`;

  return {
    template: getApiTemplate({ ...params, url, payload, arguments, response }, options),
    type: schemasstr
  }
};

async function getRequestFile(json, options) {
  let ApiFileContent = "";
  const baseUrl = json.servers[0].url;
  ApiFileContent += getTemplateHeader({ baseUrl });

  const paths = Object.keys(json.paths);

  const schemas = json.components.schemas;

  const suffix = options.suffix;

  // .d.ts文件内容
  let dotDTSFileContent = "";

  paths.forEach((path) => {
    const info = json.paths[path];
    const method = Object.keys(info)[0];

    const { template, type } = getApi({ path, method, ...info[method] }, options, schemas);

    ApiFileContent += `${template}`;
    if (type) {
      dotDTSFileContent += `${type}`
    }
  });

  let outPathUrl = __dirname;
  const _path = parsed.o;
  if (_path && typeof _path !== "boolean") {
    outPathUrl = _path;
  }
  const fileName = `api.${options.suffix}`;
  await fs.writeFile(path.resolve(outPathUrl, fileName), ApiFileContent);
  if (suffix === "ts") {
    await fs.writeFile(path.resolve(outPathUrl, "type.d.ts"), dotDTSFileContent);
  }
  schemasSet.clear();
  return paths;
};

module.exports = {
  getRequestFile
}