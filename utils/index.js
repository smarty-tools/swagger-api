const getTemplateHeader = (info) => {
  return `
const baseUrl = "${info.baseUrl}";
`
};

const getApi = (params, isParseParams) => {

  const payload = params.method === "get" ? "{ params }" : "params";

  return `
/**
 * ${params.summary || "请补充描述..."}
 * @param {*} params 
 * @returns 
 */
export const ${params.operationId} = async (params) => {
  const response = await axiosInstance.${params.method}(\`\${baseUrl}${params.path}\`, ${payload});

  return response;
};
`
};

exports = {
  getTemplateHeader,
  getApi,
}

module.exports = exports;
