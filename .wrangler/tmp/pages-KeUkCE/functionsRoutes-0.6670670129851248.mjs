import { onRequestDelete as __api_files_delete_js_onRequestDelete } from "/home/aram/Stuff/Chinra/functions/api/files/delete.js"
import { onRequestGet as __api_files_list_js_onRequestGet } from "/home/aram/Stuff/Chinra/functions/api/files/list.js"
import { onRequestPost as __api_files_mkdir_js_onRequestPost } from "/home/aram/Stuff/Chinra/functions/api/files/mkdir.js"
import { onRequestPost as __api_files_move_js_onRequestPost } from "/home/aram/Stuff/Chinra/functions/api/files/move.js"
import { onRequestPost as __api_files_upload_js_onRequestPost } from "/home/aram/Stuff/Chinra/functions/api/files/upload.js"
import { onRequestGet as __api_r2_proxy_js_onRequestGet } from "/home/aram/Stuff/Chinra/functions/api/r2-proxy.js"

export const routes = [
    {
      routePath: "/api/files/delete",
      mountPath: "/api/files",
      method: "DELETE",
      middlewares: [],
      modules: [__api_files_delete_js_onRequestDelete],
    },
  {
      routePath: "/api/files/list",
      mountPath: "/api/files",
      method: "GET",
      middlewares: [],
      modules: [__api_files_list_js_onRequestGet],
    },
  {
      routePath: "/api/files/mkdir",
      mountPath: "/api/files",
      method: "POST",
      middlewares: [],
      modules: [__api_files_mkdir_js_onRequestPost],
    },
  {
      routePath: "/api/files/move",
      mountPath: "/api/files",
      method: "POST",
      middlewares: [],
      modules: [__api_files_move_js_onRequestPost],
    },
  {
      routePath: "/api/files/upload",
      mountPath: "/api/files",
      method: "POST",
      middlewares: [],
      modules: [__api_files_upload_js_onRequestPost],
    },
  {
      routePath: "/api/r2-proxy",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_r2_proxy_js_onRequestGet],
    },
  ]