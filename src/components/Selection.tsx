import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const Selection =  ({ selected, setSelected }: { selected: string, setSelected: (value: string) => void }) => {
    return (
        <div>
            <RadioGroup defaultValue="option-one" className="flex gap-4" value={selected} onValueChange={setSelected}>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option-one" id="option-one" />
                    <Label htmlFor="option-one">Do It Myself</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option-two" id="option-two" />
                    <Label htmlFor="option-two">AI Generate</Label>
                </div>
            </RadioGroup>
        </div>
    )
}

export default Selection