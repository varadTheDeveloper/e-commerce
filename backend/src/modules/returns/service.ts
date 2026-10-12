import { MedusaService } from "@medusajs/framework/utils"
import ReturnRequest from "./models/return-request"

class ReturnsModuleService extends MedusaService({ ReturnRequest }) {}

export default ReturnsModuleService
